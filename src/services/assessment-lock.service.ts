import prisma from '../config/db';

type MutationBlock = {
  status: number;
  error: string;
};

type LiveWindowTestSeries = {
  is_active: boolean;
  is_published: boolean;
  available_from: Date;
  available_until: Date | null;
};

const isTestSeriesLiveNow = (
  testSeries: LiveWindowTestSeries,
  now = new Date()
): boolean => {
  if (!testSeries.is_active || !testSeries.is_published) {
    return false;
  }

  if (testSeries.available_from > now) {
    return false;
  }

  if (testSeries.available_until && testSeries.available_until < now) {
    return false;
  }

  return true;
};

export const getTestSeriesMutationBlock = async (
  testSeriesId: string,
  action: string
): Promise<MutationBlock | null> => {
  const [testSeries, inProgressAttempts, totalAttempts] = await prisma.$transaction([
    prisma.testSeries.findUnique({
      where: { id: testSeriesId },
      select: {
        id: true,
        is_active: true,
        is_published: true,
        available_from: true,
        available_until: true,
      },
    }),
    prisma.testAttempt.count({
      where: { test_series_id: testSeriesId, status: 'in_progress' },
    }),
    prisma.testAttempt.count({
      where: { test_series_id: testSeriesId },
    }),
  ]);

  if (!testSeries) {
    return { status: 404, error: 'Test Series not found' };
  }

  if (inProgressAttempts > 0) {
    return {
      status: 409,
      error: `Cannot ${action} while ${inProgressAttempts} student attempt(s) are currently in progress for this test series.`,
    };
  }

  if (action !== 'update this test series' && isTestSeriesLiveNow(testSeries)) {
    return {
      status: 409,
      error: `Cannot ${action} while this test series is live and available to students.`,
    };
  }

  if (action.includes('delete') && totalAttempts > 0) {
    return {
      status: 409,
      error: 'Cannot delete this test series because student attempt history already exists. Deactivate or archive it instead.',
    };
  }

  return null;
};

export const getExamMutationBlock = async (
  examId: string,
  action: string
): Promise<MutationBlock | null> => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true },
  });

  if (!exam) {
    return { status: 404, error: 'Exam not found' };
  }

  const now = new Date();

  const [liveTestSeriesCount, inProgressAttempts] = await prisma.$transaction([
    prisma.testSeries.count({
      where: {
        exam_id: examId,
        is_active: true,
        is_published: true,
        available_from: { lte: now },
        OR: [
          { available_until: null },
          { available_until: { gte: now } },
        ],
      },
    }),
    prisma.testAttempt.count({
      where: {
        status: 'in_progress',
        test_series: {
          exam_id: examId,
        },
      },
    }),
  ]);

  if (inProgressAttempts > 0) {
    return {
      status: 409,
      error: `Cannot ${action} while ${inProgressAttempts} student attempt(s) are in progress under this exam.`,
    };
  }

  if (liveTestSeriesCount > 0) {
    return {
      status: 409,
      error: `Cannot ${action} while ${liveTestSeriesCount} test series are live under this exam.`,
    };
  }

  return null;
};
