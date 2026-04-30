import { CacheService } from './src/services/cache.service';
import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

async function clear() {
  await redis.flushall();
  console.log("Redis cache cleared!");
}

clear().catch(console.error).finally(() => redis.disconnect());
