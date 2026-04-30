import prisma from './src/config/db';

async function check() {
  const tests = await prisma.testSeries.findMany({
    where: {
      is_active: true,
      is_published: true,
    },
    select: {
      id: true,
      title: true,
      is_active: true,
      is_published: true,
      exam_category_id: true,
      available_from: true,
      available_until: true,
    }
  });
  console.log("ALL PUBLISHED & ACTIVE TESTS:");
  console.log(JSON.stringify(tests, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
