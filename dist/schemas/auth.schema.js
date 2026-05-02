"use strict";
// src/schemas/auth.schema.ts
// Zod v4 compatible validation schemas for all auth endpoints
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = exports.deleteAccountSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.updateProfileSchema = exports.refreshTokenSchema = exports.googleLoginSchema = exports.loginSchema = exports.registerSchema = exports.verifyOtpSchema = exports.requestOtpSchema = void 0;
const zod_1 = require("zod");
// ==========================================
// Shared Validators
// ==========================================
const indianPhoneRegex = /^(\+91)?[6-9]\d{9}$/;
const isEmail = (val) => val.includes('@');
const isPhone = (val) => indianPhoneRegex.test(val.replace(/\s/g, ''));
/** Validates that `id` is either a valid email or an Indian phone number */
const idField = zod_1.z
    .string({ message: 'Email or Phone is required' })
    .min(1, 'Email or Phone is required')
    .refine((val) => isEmail(val) || isPhone(val), { message: 'Must be a valid email address or Indian phone number (e.g., +919876543210)' });
const otpField = zod_1.z
    .string({ message: 'OTP is required' })
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits');
const passwordField = zod_1.z
    .string({ message: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');
// ==========================================
// Endpoint Schemas
// ==========================================
exports.requestOtpSchema = zod_1.z.object({
    id: idField,
});
exports.verifyOtpSchema = zod_1.z.object({
    id: idField,
    otp: otpField,
});
exports.registerSchema = zod_1.z.object({
    id: idField,
    password: passwordField,
    full_name: zod_1.z.string().min(2, 'Full name must be at least 2 characters').max(100),
    otp: otpField,
    device_fingerprint: zod_1.z.string().optional(),
    device_name: zod_1.z.string().optional(),
});
exports.loginSchema = zod_1.z.object({
    id: idField,
    password: zod_1.z.string({ message: 'Password is required' }).min(1, 'Password is required'),
    device_fingerprint: zod_1.z.string().optional(),
    device_name: zod_1.z.string().optional(),
});
exports.googleLoginSchema = zod_1.z.object({
    idToken: zod_1.z.string({ message: 'Google ID Token is required' }).min(1),
    device_fingerprint: zod_1.z.string().optional(),
    device_name: zod_1.z.string().optional(),
});
exports.refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string({ message: 'Refresh token is required' }).min(1),
});
exports.updateProfileSchema = zod_1.z.object({
    full_name: zod_1.z.string().min(2).max(100).optional(),
    avatar_id: zod_1.z.number().int().min(0).optional(),
    target_exam_id: zod_1.z.string().uuid().optional().nullable(),
    study_language: zod_1.z.enum(['en', 'hi', 'both']).optional(),
    prep_level: zod_1.z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    daily_study_hours: zod_1.z.number().min(0).max(24).optional(),
    daily_goal_minutes: zod_1.z.number().int().min(5).max(480).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided for update' });
exports.forgotPasswordSchema = zod_1.z.object({
    id: idField,
});
exports.resetPasswordSchema = zod_1.z.object({
    id: idField,
    otp: otpField,
    new_password: passwordField,
});
exports.deleteAccountSchema = zod_1.z.object({
    password: zod_1.z.string().optional(),
    reason: zod_1.z.string().max(500).optional(),
});
// ==========================================
// Zod Validation Middleware Helper
// ==========================================
/**
 * Express middleware factory that validates req.body against a Zod schema.
 * Returns 400 with structured error details on failure.
 * Compatible with Zod v4.
 */
const validate = (schema) => {
    return (req, res, next) => {
        var _a;
        const result = schema.safeParse(req.body);
        if (!result.success) {
            // Zod v4 uses z.ZodError which has an `issues` array
            const issues = ((_a = result.error) === null || _a === void 0 ? void 0 : _a.issues) || [];
            const errors = issues.map((issue) => {
                var _a;
                return ({
                    field: ((_a = issue.path) === null || _a === void 0 ? void 0 : _a.join('.')) || 'unknown',
                    message: issue.message || 'Validation error',
                });
            });
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors,
            });
        }
        // Replace req.body with the parsed (cleaned) data
        req.body = result.data;
        next();
    };
};
exports.validate = validate;
