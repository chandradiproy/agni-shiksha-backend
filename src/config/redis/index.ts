// src/config/redis/index.ts

import dotenv from 'dotenv';
dotenv.config();

// 1. Define the exact methods your controllers will use
export interface RedisClientInterface {
  get(key: string): Promise<string | null>;
  setEx(key: string, seconds: number, value: string): Promise<any>;
  del(key: string): Promise<any>;
}

let redisInstance: any = null;
const provider = process.env.REDIS_PROVIDER || 'node';

console.log(`[Redis] Selected provider: ${provider}`);

async function initializeRedis() {
  try {
    if (provider === 'upstash') {
      console.log('[Redis] Using Upstash REST provider');
      const { createUpstashClient } = await import('./upstash');
      redisInstance = createUpstashClient();
    } else {
      console.log('[Redis] Using Node/Azure Socket provider');
      const { createNodeRedisClient } = await import('./nodeRedis');
      redisInstance = await createNodeRedisClient();
    }

    console.log('[Redis] Initialization completed successfully');
    return redisInstance;
  } catch (error) {
    console.error('[Redis] Initialization failed:', error);
    process.exit(1);
  }
}

// 2. Cast the Proxy to the Interface to fix the TS2339 error
const redisProxy = new Proxy({} as RedisClientInterface, {
  get: (target, prop) => {
    if (!redisInstance) {
      throw new Error('[Redis] Client accessed before initialization completed!');
    }
    const property = redisInstance[prop as keyof typeof redisInstance];
    return typeof property === 'function' ? property.bind(redisInstance) : property;
  }
}) as RedisClientInterface;

export { initializeRedis };
export default redisProxy;