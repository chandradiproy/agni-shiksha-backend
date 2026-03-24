"use strict";
// src/config/redis/index.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.initializeRedis = initializeRedis;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let redisInstance = null;
const provider = process.env.REDIS_PROVIDER || 'node';
console.log(`[Redis] Selected provider: ${provider}`);
function initializeRedis() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (provider === 'upstash') {
                console.log('[Redis] Using Upstash REST provider');
                const { createUpstashClient } = yield Promise.resolve().then(() => __importStar(require('./upstash')));
                redisInstance = createUpstashClient();
            }
            else {
                console.log('[Redis] Using Node/Azure Socket provider');
                const { createNodeRedisClient } = yield Promise.resolve().then(() => __importStar(require('./nodeRedis')));
                redisInstance = yield createNodeRedisClient();
            }
            console.log('[Redis] Initialization completed successfully');
            return redisInstance;
        }
        catch (error) {
            console.error('[Redis] Initialization failed:', error);
            process.exit(1);
        }
    });
}
// 2. Cast the Proxy to the Interface to fix the TS2339 error
const redisProxy = new Proxy({}, {
    get: (target, prop) => {
        if (!redisInstance) {
            throw new Error('[Redis] Client accessed before initialization completed!');
        }
        const property = redisInstance[prop];
        return typeof property === 'function' ? property.bind(redisInstance) : property;
    }
});
exports.redis = new Proxy({}, {
    get: (target, prop) => {
        if (!redisInstance) {
            throw new Error('[Redis] Client accessed before initialization completed!');
        }
        const property = redisInstance[prop];
        if (typeof property === 'function') {
            return property.bind(redisInstance);
        }
        return property;
    },
});
exports.default = redisProxy;
