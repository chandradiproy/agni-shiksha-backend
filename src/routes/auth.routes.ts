// src/routes/auth.routes.ts

import { Router } from 'express';
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
} from '../controllers/auth.controller';

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
router.post('/request-otp', validate(requestOtpSchema), requestOtp);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), loginWithPassword);
router.post('/google', validate(googleLoginSchema), googleLogin);
router.post('/refresh-token', validate(refreshTokenSchema), refreshToken);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

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
router.delete('/account', requireAuth, validate(deleteAccountSchema), deleteAccount);

export default router;