"use strict";
// src/routes/auth.routes.ts
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
const express_1 = require("express");
const cache_service_1 = require("../services/cache.service");
const redis_1 = __importDefault(require("../config/redis"));
const auth_controller_1 = require("../controllers/auth.controller");
const rateLimiter_1 = require("../middlewares/rateLimiter");
const biometric_controller_1 = require("../controllers/biometric.controller");
const auth_1 = require("../middlewares/auth");
const auth_schema_1 = require("../schemas/auth.schema");
const auth_schema_2 = require("../schemas/auth.schema");
const router = (0, express_1.Router)();
// ==========================================
// PUBLIC ROUTES (No auth required)
// ==========================================
router.post('/request-otp', rateLimiter_1.otpRateLimit, (0, auth_schema_1.validate)(auth_schema_2.requestOtpSchema), auth_controller_1.requestOtp);
router.post('/verify-otp', (0, auth_schema_1.validate)(auth_schema_2.verifyOtpSchema), auth_controller_1.verifyOtp);
router.post('/register', rateLimiter_1.registrationRateLimit, (0, auth_schema_1.validate)(auth_schema_2.registerSchema), auth_controller_1.register);
router.post('/login', rateLimiter_1.loginRateLimit, (0, auth_schema_1.validate)(auth_schema_2.loginSchema), auth_controller_1.loginWithPassword);
router.post('/google', (0, auth_schema_1.validate)(auth_schema_2.googleLoginSchema), auth_controller_1.googleLogin);
router.post('/refresh-token', (0, auth_schema_1.validate)(auth_schema_2.refreshTokenSchema), auth_controller_1.refreshToken);
router.post('/forgot-password', rateLimiter_1.otpRateLimit, (0, auth_schema_1.validate)(auth_schema_2.forgotPasswordSchema), auth_controller_1.forgotPassword);
router.post('/reset-password', (0, auth_schema_1.validate)(auth_schema_2.resetPasswordSchema), auth_controller_1.resetPassword);
router.get('/session-status', auth_controller_1.getSessionStatus); // Light check, no auth required
// ==========================================
// BIOMETRIC ROUTES (Mixed auth)
// ==========================================
router.post('/biometric/register-options', auth_1.requireAuth, biometric_controller_1.getRegistrationOptions);
router.post('/biometric/register-verify', auth_1.requireAuth, biometric_controller_1.verifyRegistration);
router.post('/biometric/login-options', biometric_controller_1.getLoginOptions); // Public — needs userId in body
router.post('/biometric/login-verify', biometric_controller_1.verifyLogin); // Public — returns tokens
// Android-specific RSA endpoints (react-native-biometrics)
router.post('/biometric/rn-register', auth_1.requireAuth, biometric_controller_1.verifyRnBiometricRegistration);
router.post('/biometric/rn-login', biometric_controller_1.verifyRnBiometricLogin);
// ==========================================
// PROTECTED ROUTES (Auth required)
// ==========================================
router.post('/logout', auth_1.requireAuth, auth_controller_1.logout);
router.post('/logout-all', auth_1.requireAuth, auth_controller_1.logoutAll);
router.get('/me', auth_1.requireAuth, auth_controller_1.getMe);
router.put('/me', auth_1.requireAuth, (0, auth_schema_1.validate)(auth_schema_2.updateProfileSchema), auth_controller_1.updateMe);
router.put('/me/fcm-token', auth_1.requireAuth, auth_controller_1.updateFcmToken);
router.delete('/account', auth_1.requireAuth, (0, auth_schema_1.validate)(auth_schema_2.deleteAccountSchema), auth_controller_1.deleteAccount);
// ==========================================
// TEMPORARY CACHE TESTING ROUTE
// ==========================================
router.post('/test-push', auth_controller_1.testPushNotification);
router.get('/test-invalidation', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const oldV = yield redis_1.default.get('cache_v:articles');
    yield cache_service_1.CacheService.invalidateTag('articles');
    const newV = yield redis_1.default.get('cache_v:articles');
    res.json({ oldVersion: oldV || '1', newVersion: newV, message: 'Articles cache successfully purged!' });
}));
exports.default = router;
