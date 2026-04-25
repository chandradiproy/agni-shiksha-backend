// src/controllers/student/test.controller.ts

import { Request, Response } from 'express';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../../config/db';
import { CacheService } from '../../services/cache.service';

// Create a dedicated IORedis connection specifically for BullMQ.
// BullMQ requires native IORedis for blocking operations. It cannot use the REST Proxy.
const queueConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null // Strictly required by BullMQ
});

export const submissionQueue = new Queue('test-submissions', { 
  connection: queueConnection as any // Type assertion to satisfy BullMQ's expected connection type
});

// ==========================================
// 1. GET AVAILABLE TESTS
// ==========================================
export const getAvailableTests = async (req: Request, res: Response) => {
  try {
    const { examId, type, categoryId } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const bypassCache = req.headers['x-bypass-cache'] === 'true';

    const whereClause: any = {
      is_active: true,
      is_published: true,
    };

    if (examId) whereClause.exam_id = examId as string;
    if (categoryId) whereClause.exam_category_id = categoryId as string;
    if (type) {
      const upperType = (type as string).toUpperCase();
      whereClause.type = upperType;
    }
    const cacheScope = `available_tests:cat:${categoryId || 'all'}:exam:${examId || 'all'}:type:${type ? (type as string).toUpperCase() : 'all'}:page:${page}:limit:${limit}`;
    const cachedResponse = bypassCache ? null : await CacheService.get<any>('tests', cacheScope);

    if (cachedResponse) {
      return res.status(200).json(cachedResponse);
    }

    const [tests, totalCount] = await Promise.all([
      prisma.testSeries.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          title: true,
          type: true,
          test_type: true,
          difficulty: true,
          total_questions: true,
          duration_minutes: true,
          total_marks: true,
          available_from: true,
          available_until: true,
        }
      }),
      prisma.testSeries.count({ where: whereClause })
    ]);

    const responsePayload = {
      success: true,
      data: tests,
      pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) }
    };

    await CacheService.set('tests', cacheScope, responsePayload, 600);

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Get Available Tests Error:', error);
    res.status(500).json({ error: 'Failed to fetch available tests' });
  }
};

// ==========================================
// 2. GET TEST DETAILS & PREVIOUS ATTEMPTS
// ==========================================
export const getTestDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id as string;

    const testInfoScope = `test_details:${id}`;
    let testSeries = await CacheService.get<any>('tests', testInfoScope);

    if (!testSeries) {
      testSeries = await prisma.testSeries.findFirst({
        where: { id: id as string, is_active: true, is_published: true },
      });

      if (testSeries) {
        await CacheService.set('tests', testInfoScope, testSeries, 900);
      }
    }

    if (!testSeries) {
      return res.status(404).json({ error: 'Test Series not found or unavailable' });
    }

    // Check how many times the user has already attempted this test
    const previousAttempts = await prisma.testAttempt.findMany({
      where: { test_series_id: testSeries.id, user_id: userId },
      orderBy: { started_at: 'desc' },
      select: { id: true, status: true, score: true, percentage: true, started_at: true }
    });

    res.status(200).json({
      success: true,
      data: {
        test_info: testSeries,
        attempts: previousAttempts,
        can_attempt: previousAttempts.length < testSeries.max_attempts
      }
    });
  } catch (error) {
    console.error('Get Test Details Error:', error);
    res.status(500).json({ error: 'Failed to fetch test details' });
  }
};

// ==========================================
// 3. START A TEST
// ==========================================
export const startTest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id as string;

    const testSeries = await prisma.testSeries.findUnique({
      where: { id: id as string }
    });

    if (!testSeries || !testSeries.is_active || !testSeries.is_published) {
      return res.status(404).json({ error: 'Test Series is not available' });
    }

    // Check Max Attempts
    const attemptCount = await prisma.testAttempt.count({
      where: { test_series_id: testSeries.id, user_id: userId }
    });

    if (attemptCount >= testSeries.max_attempts) {
      return res.status(403).json({ error: 'Maximum attempts reached for this test' });
    }

    // Check for an already 'in_progress' attempt to resume
    let attempt = await prisma.testAttempt.findFirst({
      where: { test_series_id: testSeries.id, user_id: userId, status: 'in_progress' }
    });

    // If no active attempt, create a new one
    if (!attempt) {
      attempt = await prisma.testAttempt.create({
        data: {
          user_id: userId,
          test_series_id: testSeries.id,
          status: 'in_progress',
          score: 0,
          percentage: 0,
          attempt_number: attemptCount + 1 // FIX: Added the missing attempt_number field required by Prisma
        }
      });
    }

    // Fetch Questions
    const questionsScope = `start_test_questions:${testSeries.id}`;
    let secureQuestions = await CacheService.get<any[]>('tests', questionsScope);

    if (!secureQuestions) {
      const rawQuestions = await prisma.question.findMany({
        where: { test_series_id: testSeries.id },
        orderBy: { display_order: 'asc' }
      });

      // CRITICAL FIX: Map questions securely.
      // We MUST remove `is_correct` and `correct_option_id` from the payload so tech-savvy students can't cheat!
      secureQuestions = rawQuestions.map((q) => {
        const secureOptions = (q.options as any[]).map(opt => ({
          id: opt.id,
          text: opt.text
        }));

        return {
          id: q.id,
          subject: q.subject,
          topic: q.topic,
          section: q.section,
          question_type: q.question_type,
          question_text: q.question_text,
          question_text_hindi: q.question_text_hindi,
          marks: q.marks,
          options: secureOptions
        };
      });

      await CacheService.set('tests', questionsScope, secureQuestions, 3600);
    }

    res.status(200).json({
      success: true,
      data: {
        attempt_id: attempt.id,
        duration_minutes: testSeries.duration_minutes,
        questions: secureQuestions
      }
    });

  } catch (error) {
    console.error('Start Test Error:', error);
    res.status(500).json({ error: 'Failed to start test' });
  }
};

// ==========================================
// 4. SUBMIT TEST (Highly Scalable Engine)
// ==========================================
// 4. SUBMIT TEST (Ultimate BullMQ Scalable Engine)
// ==========================================
export const submitTest = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const { answers, time_taken_seconds } = req.body; 
    const userId = (req as any).user.id as string;

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId as string },
      include: { test_series: true }
    });

    if (!attempt || attempt.user_id !== userId) {
      return res.status(404).json({ error: 'Test attempt not found' });
    }

    if (attempt.status === 'completed') {
      return res.status(400).json({ error: 'This test attempt has already been submitted.' });
    }

    const testSeries = attempt.test_series;

    // SCALABILITY FIX 1: Fetch Answer Key from Redis Cache
    const cacheScope = `test_answer_key:${testSeries.id}`;
    let questions = await CacheService.get<any[]>('tests', cacheScope);

    if (!questions) {
      questions = await prisma.question.findMany({
        where: { test_series_id: testSeries.id }
      });
      await CacheService.set('tests', cacheScope, questions, 7200);
    }

    // Scoring Variables
    let totalScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    const subjectScores: Record<string, number> = {};

    const questionsMap = new Map(questions.map((q: any) => [q.id, q]));

    // Grade each answer in memory (blazing fast - takes < 1ms)
    answers.forEach((ans: any) => {
      // FIX: Explicitly cast 'q' to 'any' so TypeScript knows it contains the properties parsed from Redis
      const q: any = questionsMap.get(ans.question_id);
      if (!q) return;

      if (!subjectScores[q.subject]) subjectScores[q.subject] = 0;

      if (ans.selected_option_id === q.correct_option_id) {
        totalScore += Number(q.marks);
        subjectScores[q.subject] += Number(q.marks);
        correctCount++;
      } else if (ans.selected_option_id) { 
        incorrectCount++;
        if (testSeries.negative_marking && testSeries.negative_marks_per_wrong) {
          totalScore -= Number(testSeries.negative_marks_per_wrong);
          subjectScores[q.subject] -= Number(testSeries.negative_marks_per_wrong);
        }
      }
    });

    const finalScore = Math.max(0, totalScore);
    const percentage = (finalScore / testSeries.total_marks) * 100;

    // ========================================================
    // SCALABILITY FIX 2 & 3: BULLMQ OFF-LOADING
    // We instantly push all Database writes to the Queue and 
    // respond to the user without waiting for the DB to lock!
    // ========================================================
    await submissionQueue.add('process-submission', {
      attemptId,
      userId,
      finalScore,
      percentage: Number(percentage.toFixed(2)),
      subjectScores,
      timeTakenSeconds: time_taken_seconds || 0
    }, {
      removeOnComplete: true, // Keep Redis clean
      attempts: 3,            // Retry if DB temporarily locks
      backoff: { type: 'exponential', delay: 2000 }
    });

    // Immediately return the memory-graded score back to the frontend
    // We use HTTP 202 (Accepted) to indicate the job is processing securely in the background
    res.status(202).json({
      success: true,
      message: 'Test submitted and is being securely saved',
      data: {
        score: finalScore,
        percentage: Number(percentage.toFixed(2)),
        correct_count: correctCount,
        incorrect_count: incorrectCount
      }
    });

  } catch (error) {
    console.error('Submit Test Error:', error);
    res.status(500).json({ error: 'Failed to submit test' });
  }
};

// ==========================================
// 5. SYNC EXAM ANSWERS (Offline Recovery Engine)
// ==========================================
export const syncAttemptAnswers = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const { incremental_answers } = req.body; // Expects an array: { question_id, selected_option_id, time_taken }[]
    const userId = (req as any).user.id as string;

    if (!Array.isArray(incremental_answers) || incremental_answers.length === 0) {
      return res.status(200).json({ success: true, message: 'Nothing to sync' });
    }

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId as string }
    });

    if (!attempt || attempt.user_id !== userId) {
      return res.status(404).json({ error: 'Test attempt not found' });
    }

    if (attempt.status === 'completed') {
      return res.status(400).json({ error: 'Attempt already submitted' });
    }

    // Attempt.answers is a JSON array. We need to merge incremental_answers into it.
    // Parse current array
    const currentAnswers: any[] = Array.isArray(attempt.answers) ? attempt.answers as any[] : [];
    
    // Merge by question_id (upsert logic in memory)
    const answersMap = new Map(currentAnswers.map(ans => [ans.question_id, ans]));
    
    incremental_answers.forEach((incAns) => {
      // Overwrite or add
      answersMap.set(incAns.question_id, {
        question_id: incAns.question_id,
        selected_option_id: incAns.selected_option_id,
        time_taken: incAns.time_taken || 0
      });
    });

    const mergedAnswers = Array.from(answersMap.values());

    await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        answers: mergedAnswers
      }
    });

    res.status(200).json({ success: true, message: 'Answers synced successfully', synced_count: incremental_answers.length });
  } catch (error) {
    console.error('Sync Test Error:', error);
    res.status(500).json({ error: 'Failed to sync answers' });
  }
};

// ==========================================
// 6. GET MY ATTEMPTS (History)
// ==========================================
export const getMyAttempts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [attempts, totalCount] = await Promise.all([
      prisma.testAttempt.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: { started_at: 'desc' },
        include: {
          test_series: {
            select: { id: true, title: true, type: true, test_type: true, difficulty: true, total_marks: true, duration_minutes: true }
          }
        }
      }),
      prisma.testAttempt.count({ where: { user_id: userId } })
    ]);

    res.status(200).json({
      success: true,
      data: attempts,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get My Attempts Error:', error);
    res.status(500).json({ error: 'Failed to fetch attempt history' });
  }
};

// ==========================================
// 7. REPORT QUESTION
// ==========================================
export const reportQuestion = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const { question_id, reason } = req.body;
    const userId = (req as any).user.id as string;

    if (!question_id || !reason) {
      return res.status(400).json({ error: 'question_id and reason are required' });
    }

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId as string }
    });

    if (!attempt || attempt.user_id !== userId) {
      return res.status(404).json({ error: 'Test attempt not found' });
    }

    // We reuse the Report model originally defined for Forum, using item_type="QUESTION"
    const report = await prisma.report.create({
      data: {
        reported_by_user_id: userId,
        item_id: question_id,
        item_type: 'QUESTION',
        reason: reason
      }
    });

    res.status(201).json({ success: true, message: 'Question reported successfully', data: report });
  } catch (error) {
    console.error('Report Question Error:', error);
    res.status(500).json({ error: 'Failed to report question' });
  }
};
