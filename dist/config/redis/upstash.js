"use strict";
// src/config/redis/upstash.ts
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
exports.createUpstashClient = void 0;
const redis_1 = require("@upstash/redis");
const createUpstashClient = () => {
    try {
        console.log('[Redis][Upstash] Initializing client...');
        const client = new redis_1.Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        console.log('[Redis][Upstash] Client initialized successfully');
        // Return an adapter that matches our RedisClientInterface
        return {
            get: (key) => __awaiter(void 0, void 0, void 0, function* () {
                const value = yield client.get(key);
                if (value === null || value === undefined)
                    return null;
                return typeof value === 'object' ? JSON.stringify(value) : String(value);
            }),
            setEx: (key, seconds, value) => __awaiter(void 0, void 0, void 0, function* () { return client.set(key, value, { ex: seconds }); }),
            del: (key) => __awaiter(void 0, void 0, void 0, function* () { return client.del(key); }),
        };
    }
    catch (error) {
        console.error('[Redis][Upstash] Initialization failed:', error);
        throw error;
    }
};
exports.createUpstashClient = createUpstashClient;
