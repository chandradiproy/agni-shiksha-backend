import prisma from './src/config/db';
import { CacheService } from './src/services/cache.service';

async function update() {
  await prisma.testSeries.update({
    where: { id: '6179981d-5baa-469c-b85f-57485de3aacb' },
    data: { is_published: false }
  });
  console.log("Unpublished test series 6179981d-5baa-469c-b85f-57485de3aacb via script.");
  await CacheService.invalidateTag('tests');
  console.log("Cache Invalidated.");
}

update().catch(console.error).finally(() => prisma.$disconnect());
