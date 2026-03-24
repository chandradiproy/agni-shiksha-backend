"use strict";
// src/config/redis/nodeRedis.ts
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
exports.createNodeRedisClient = void 0;
const redis_1 = require("redis");
const createNodeRedisClient = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log('[Redis][Node] Creating client...');
    const isLocal = (_a = process.env.REDIS_URL) === null || _a === void 0 ? void 0 : _a.includes('localhost');
    const client = (0, redis_1.createClient)({
        url: process.env.REDIS_URL,
        pingInterval: 10000,
        socket: Object.assign(Object.assign({}, (isLocal
            ? {}
            : { tls: true })), { reconnectStrategy: (retries) => {
                console.warn(`[Redis][Node] Reconnecting... Attempt: ${retries}`);
                if (retries > 20)
                    return new Error('Max Redis reconnect retries reached');
                return Math.min(retries * 50, 2000);
            } }),
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
        yield client.connect();
        return client;
    }
    catch (error) {
        console.error('[Redis][Node] Connection failed:', error);
        throw error;
    }
});
exports.createNodeRedisClient = createNodeRedisClient;
