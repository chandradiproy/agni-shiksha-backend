// src/config/redis/index.ts

import dotenv from 'dotenv';
dotenv.config();

// 1. Define the exact methods your controllers will use
export interface RedisClientInterface {
  get(key: string): Promise<string | null>;
  setEx(key: string, seconds: number, value: string): Promise<any>;
  del(key: string): Promise<any>;
  exists(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  sendCommand(args: string[]): Promise<any>;
  incr?(key: string): Promise<number>; 
}

let redisInstance: any = null;
let initPromise: Promise<any> | null = null;
const provider = process.env.REDIS_PROVIDER || 'node';

console.log(`[Redis] Selected provider: ${provider}`);

async function initializeRedis() {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
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
  })();
  
  return initPromise;
}

/**
 * PROXY HANDLER
 * This allows us to export a 'redis' object that doesn't exist yet.
 * It will wait for initialization if a method is called before it's ready.
 */
const createRedisProxy = () => {
  return new Proxy({} as RedisClientInterface, {
    get: (target, prop) => {
      // If the property is being accessed, return a function that waits for initialization
      return async (...args: any[]) => {
        if (!redisInstance) {
          // If not initialized, wait for the initPromise
          // If initPromise doesn't exist, we might be in a weird state where it was never called
          if (!initPromise) {
            console.warn(`[Redis] Method ${String(prop)} called before initializeRedis(). Starting init now...`);
            await initializeRedis();
          } else {
            await initPromise;
          }
        }
        
        const method = redisInstance[prop as keyof typeof redisInstance];
        if (typeof method !== 'function') {
          return method;
        }
        return method.bind(redisInstance)(...args);
      };
    }
  }) as RedisClientInterface;
};

export const redis = createRedisProxy();
export const redisProxy = redis; // For backward compatibility

export { initializeRedis };
export default redis;