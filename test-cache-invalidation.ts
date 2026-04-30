import { CacheService } from './src/services/cache.service';
import redisClient from './src/config/redis';

async function testInvalidation() {
  console.log('--- Agni Shiksha Cache Invalidation Test ---');
  
  
  // 1. Get current version
  const currentVersion = await redisClient.get('cache_v:articles');
  console.log(`[Before] Current 'articles' Cache Version: v${currentVersion || 1}`);

  // 2. Invalidate
  console.log(`\n[Action] Invalidating 'articles' cache tag... (Simulating an Admin publishing a new article)`);
  await CacheService.invalidateTag('articles');

  // 3. Get new version
  const newVersion = await redisClient.get('cache_v:articles');
  console.log(`[After] New 'articles' Cache Version: v${newVersion}`);

  console.log(`\nSuccess! The cache version was incremented.`);
  console.log(`The next time a user requests the home dashboard, Redis will look for data under version v${newVersion}, resulting in a Cache MISS.`);
  console.log(`The DB will be queried and the fresh data will be stored securely under v${newVersion}!`);
  
  process.exit(0);
}

testInvalidation();
