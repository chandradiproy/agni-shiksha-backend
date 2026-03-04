// src/config/redis/upstash.ts

import { Redis } from '@upstash/redis';

export const createUpstashClient = () => {
  try {
    console.log('[Redis][Upstash] Initializing client...');

    const client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    console.log('[Redis][Upstash] Client initialized successfully');

    // Return an adapter that matches our RedisClientInterface
    return {
      get: async (key: string) => {
        const value = await client.get(key);
        return value ? String(value) : null;
      },
      setEx: async (key: string, seconds: number, value: string) => 
        client.set(key, value, { ex: seconds }),
      del: async (key: string) => client.del(key),
    };
  } catch (error) {
    console.error('[Redis][Upstash] Initialization failed:', error);
    throw error;
  }
};