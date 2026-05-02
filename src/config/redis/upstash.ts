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
        if (value === null || value === undefined) return null;
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      },
      setEx: async (key: string, seconds: number, value: string) => 
        client.set(key, value, { ex: seconds }),
      del: async (key: string) => client.del(key),
      exists: async (key: string) => client.exists(key),
      ttl: async (key: string) => client.ttl(key),
      sendCommand: async (args: string[]) => client.call(args[0], ...args.slice(1)),
      incr: async (key: string) => client.incr(key),
    };
  } catch (error) {
    console.error('[Redis][Upstash] Initialization failed:', error);
    throw error;
  }
};