// src/config/redis/nodeRedis.ts

import { createClient } from 'redis';

export const createNodeRedisClient = async () => {
  console.log('[Redis][Node] Creating client...');

  const isLocal = process.env.REDIS_URL?.includes('localhost');

  const client = createClient({
    url: process.env.REDIS_URL,
    pingInterval: 10000,

    socket: {
      ...(isLocal
        ? {}
        : { tls: true }), // enable TLS only for remote redis

      reconnectStrategy: (retries) => {
        console.warn(`[Redis][Node] Reconnecting... Attempt: ${retries}`);
        if (retries > 20) return new Error('Max Redis reconnect retries reached');
        return Math.min(retries * 50, 2000);
      },
    },
  });

  client.on('connect', () => {
    console.log('[Redis][Node] Connected successfully');
  });

  client.on('ready', () => {
    console.log('[Redis][Node] Client ready to use');
  });

  client.on('error', (err) => {
    console.error('[Redis][Node] Error:', err);
  });

  try {
    await client.connect();
    return client;
  } catch (error) {
    console.error('[Redis][Node] Connection failed:', error);
    throw error;
  }
};