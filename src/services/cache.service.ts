// src/services/cache.service.ts
import { redis } from "../config/redis";

/**
 * Agni Shiksha Production-Grade Cache Service
 * * This service is now perfectly mapped to your original Redis setup.
 * It uses your existing 'redis' proxy and 'setEx' method.
 */
export class CacheService {
  private static DEFAULT_TTL = 3600; // 1 Hour default
  private static VERSION_PREFIX = "cache_v:";

  /**
   * Generates a version-aware key for a specific user and data tag.
   */
  private static async getVersionedKey(tag: string, userId: string): Promise<string> {
    // Uses your existing .get() method via the proxy
    const version = await redis.get(`${this.VERSION_PREFIX}${tag}`) || "1";
    return `data:${tag}:v${version}:u:${userId}`;
  }

  /**
   * Standardized Get using your existing .get() method.
   */
  static async get<T>(tag: string, userId: string): Promise<T | null> {
    const key = await this.getVersionedKey(tag, userId);
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Standardized Set using your existing .setEx() method.
   * Matches your signature: setEx(key, seconds, value)
   */
  static async set(tag: string, userId: string, value: any, ttl = this.DEFAULT_TTL): Promise<void> {
    const key = await this.getVersionedKey(tag, userId);
    
    // Adding 1-5 minutes of random jitter to TTL to prevent mass expiry spikes
    const jitter = Math.floor(Math.random() * 300); 
    const finalTtl = ttl + jitter;

    // IMPORTANT: Using setEx to match your original nodeRedis/upstash implementation
    await redis.setEx(key, finalTtl, JSON.stringify(value));
  }

  /**
   * Logical Invalidation (The Core Strategy)
   * We use a try/catch block to ensure that if 'incr' isn't in your interface yet,
   * it falls back to a standard get/set flow.
   */
  static async invalidateTag(tag: string): Promise<void> {
    const key = `${this.VERSION_PREFIX}${tag}`;
    try {
      // @ts-ignore - Using dynamic access to avoid forcing interface changes immediately
      if (typeof redis.incr === 'function') {
        // @ts-ignore
        await redis.incr(key);
      } else {
        const current = await redis.get(key) || "1";
        const next = (parseInt(current) + 1).toString();
        // Use a long TTL for versions (e.g., 30 days)
        // Note: Using setEx with a very large number since your interface prefers setEx
        await redis.setEx(key, 86400 * 30, next);
      }
    } catch (e) {
      console.error(`[CacheService] Failed to invalidate tag ${tag}:`, e);
    }
  }
}