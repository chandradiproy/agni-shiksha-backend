// src/routes/auth.routes.ts

import { Router } from 'express';
import { CacheService } from '../services/cache.service';
import redisClient from '../config/redis';
import {
  requestOtp,
  verifyOtp,
  googleLogin,
  register,
  loginWithPassword,
  refreshToken,
  logout,
  logoutAll,
  getMe,
  updateMe,
  forgotPassword,
  resetPassword,
  deleteAccount,
  updateFcmToken,
  testPushNotification,
  getSessionStatus
} from '../controllers/auth.controller';

import { otpRateLimit, loginRateLimit, registrationRateLimit } from '../middlewares/rateLimiter';

import{  getLoginOptions,
  verifyLogin,
  verifyRnBiometricRegistration,
  verifyRnBiometricLogin,
  getRegistrationOptions,
  verifyRegistration
} from '../controllers/biometric.controller';

import { requireAuth } from '../middlewares/auth';

import { validate } from '../schemas/auth.schema';
import {
  requestOtpSchema,
  verifyOtpSchema,
  registerSchema,
  loginSchema,
  googleLoginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  deleteAccountSchema,
} from '../schemas/auth.schema';

const router = Router();

// ==========================================
// PUBLIC ROUTES (No auth required)
// ==========================================
router.post('/request-otp', otpRateLimit, validate(requestOtpSchema), requestOtp);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);
router.post('/register', registrationRateLimit, validate(registerSchema), register);
router.post('/login', loginRateLimit, validate(loginSchema), loginWithPassword);
router.post('/google', validate(googleLoginSchema), googleLogin);
router.post('/refresh-token', validate(refreshTokenSchema), refreshToken);
router.post('/forgot-password', otpRateLimit, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.get('/session-status', getSessionStatus); // Light check, no auth required

// ==========================================
// BIOMETRIC ROUTES (Mixed auth)
// ==========================================
router.post('/biometric/register-options', requireAuth, getRegistrationOptions);
router.post('/biometric/register-verify', requireAuth, verifyRegistration);
router.post('/biometric/login-options', getLoginOptions);   // Public — needs userId in body
router.post('/biometric/login-verify', verifyLogin);        // Public — returns tokens

// Android-specific RSA endpoints (react-native-biometrics)
router.post('/biometric/rn-register', requireAuth, verifyRnBiometricRegistration);
router.post('/biometric/rn-login', verifyRnBiometricLogin);

// ==========================================
// PROTECTED ROUTES (Auth required)
// ==========================================
router.post('/logout', requireAuth, logout);
router.post('/logout-all', requireAuth, logoutAll);
router.get('/me', requireAuth, getMe);
router.put('/me', requireAuth, validate(updateProfileSchema), updateMe);
router.put('/me/fcm-token', requireAuth, updateFcmToken);
router.delete('/account', requireAuth, validate(deleteAccountSchema), deleteAccount);

// ==========================================
// TEMPORARY CACHE TESTING ROUTE
// ==========================================
router.post('/test-push', testPushNotification);
router.get('/test-invalidation', async (req, res) => {
  const oldV = await redisClient.get('cache_v:articles');
  await CacheService.invalidateTag('articles');
  const newV = await redisClient.get('cache_v:articles');
  res.json({ oldVersion: oldV || '1', newVersion: newV, message: 'Articles cache successfully purged!' });
});

export default router;