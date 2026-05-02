// src/middlewares/rateLimiter.ts
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redisClient from '../config/redis';

export const otpRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
  keyGenerator: (req) => `rl_otp:${req.body?.id || ipKeyGenerator(req.ip ?? '')}`,
  message: { error: 'Too many OTP requests. Please wait 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false },
});

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
  keyGenerator: (req) => `rl_login:${ipKeyGenerator(req.ip ?? '')}`,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
  validate: { ip: false },
});

export const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
  keyGenerator: (req) => `rl_reg:${ipKeyGenerator(req.ip ?? '')}`,
  message: { error: 'Too many registration attempts. Please try again in an hour.' },
  validate: { ip: false },
});
