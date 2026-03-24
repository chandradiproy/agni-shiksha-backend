"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
// src/services/cache.service.ts
const redis_1 = require("../config/redis");
/**
 * Agni Shiksha Production-Grade Cache Service
 * * This service is now perfectly mapped to your original Redis setup.
 * It uses your existing 'redis' proxy and 'setEx' method.
 */
class CacheService {
    /**
     * Generates a version-aware key for a specific user and data tag.
     */
    static getVersionedKey(tag, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Uses your existing .get() method via the proxy
            const version = (yield redis_1.redis.get(`${this.VERSION_PREFIX}${tag}`)) || "1";
            return `data:${tag}:v${version}:u:${userId}`;
        });
    }
    /**
     * Standardized Get using your existing .get() method.
     */
    static get(tag, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = yield this.getVersionedKey(tag, userId);
            const data = yield redis_1.redis.get(key);
            return data ? JSON.parse(data) : null;
        });
    }
    /**
     * Standardized Set using your existing .setEx() method.
     * Matches your signature: setEx(key, seconds, value)
     */
    static set(tag_1, userId_1, value_1) {
        return __awaiter(this, arguments, void 0, function* (tag, userId, value, ttl = this.DEFAULT_TTL) {
            const key = yield this.getVersionedKey(tag, userId);
            // Adding 1-5 minutes of random jitter to TTL to prevent mass expiry spikes
            const jitter = Math.floor(Math.random() * 300);
            const finalTtl = ttl + jitter;
            // IMPORTANT: Using setEx to match your original nodeRedis/upstash implementation
            yield redis_1.redis.setEx(key, finalTtl, JSON.stringify(value));
        });
    }
    /**
     * Logical Invalidation (The Core Strategy)
     * We use a try/catch block to ensure that if 'incr' isn't in your interface yet,
     * it falls back to a standard get/set flow.
     */
    static invalidateTag(tag) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `${this.VERSION_PREFIX}${tag}`;
            try {
                // @ts-ignore - Using dynamic access to avoid forcing interface changes immediately
                if (typeof redis_1.redis.incr === 'function') {
                    // @ts-ignore
                    yield redis_1.redis.incr(key);
                }
                else {
                    const current = (yield redis_1.redis.get(key)) || "1";
                    const next = (parseInt(current) + 1).toString();
                    // Use a long TTL for versions (e.g., 30 days)
                    // Note: Using setEx with a very large number since your interface prefers setEx
                    yield redis_1.redis.setEx(key, 86400 * 30, next);
                }
            }
            catch (e) {
                console.error(`[CacheService] Failed to invalidate tag ${tag}:`, e);
            }
        });
    }
}
exports.CacheService = CacheService;
CacheService.DEFAULT_TTL = 3600; // 1 Hour default
CacheService.VERSION_PREFIX = "cache_v:";
