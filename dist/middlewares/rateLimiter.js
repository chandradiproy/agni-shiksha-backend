"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrationRateLimit = exports.loginRateLimit = exports.otpRateLimit = void 0;
// src/middlewares/rateLimiter.ts
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const rate_limit_redis_1 = require("rate-limit-redis");
const redis_1 = __importDefault(require("../config/redis"));
exports.otpRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5,
    store: new rate_limit_redis_1.RedisStore({ sendCommand: (...args) => redis_1.default.sendCommand(args) }),
    keyGenerator: (req) => { var _a, _b; return `rl_otp:${((_a = req.body) === null || _a === void 0 ? void 0 : _a.id) || (0, express_rate_limit_1.ipKeyGenerator)((_b = req.ip) !== null && _b !== void 0 ? _b : '')}`; },
    message: { error: 'Too many OTP requests. Please wait 10 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { ip: false },
});
exports.loginRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    store: new rate_limit_redis_1.RedisStore({ sendCommand: (...args) => redis_1.default.sendCommand(args) }),
    keyGenerator: (req) => { var _a; return `rl_login:${(0, express_rate_limit_1.ipKeyGenerator)((_a = req.ip) !== null && _a !== void 0 ? _a : '')}`; },
    message: { error: 'Too many login attempts. Please wait 15 minutes.' },
    validate: { ip: false },
});
exports.registrationRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    store: new rate_limit_redis_1.RedisStore({ sendCommand: (...args) => redis_1.default.sendCommand(args) }),
    keyGenerator: (req) => { var _a; return `rl_reg:${(0, express_rate_limit_1.ipKeyGenerator)((_a = req.ip) !== null && _a !== void 0 ? _a : '')}`; },
    message: { error: 'Too many registration attempts. Please try again in an hour.' },
    validate: { ip: false },
});
