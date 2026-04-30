// src/schemas/auth.schema.ts
// Zod v4 compatible validation schemas for all auth endpoints

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ==========================================
// Shared Validators
// ==========================================

const indianPhoneRegex = /^(\+91)?[6-9]\d{9}$/;

const isEmail = (val: string) => val.includes('@');
const isPhone = (val: string) => indianPhoneRegex.test(val.replace(/\s/g, ''));

/** Validates that `id` is either a valid email or an Indian phone number */
const idField = z
  .string({ message: 'Email or Phone is required' })
  .min(1, 'Email or Phone is required')
  .refine(
    (val) => isEmail(val) || isPhone(val),
    { message: 'Must be a valid email address or Indian phone number (e.g., +919876543210)' }
  );

const otpField = z
  .string({ message: 'OTP is required' })
  .length(6, 'OTP must be exactly 6 digits')
  .regex(/^\d{6}$/, 'OTP must contain only digits');

const passwordField = z
  .string({ message: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// ==========================================
// Endpoint Schemas
// ==========================================

export const requestOtpSchema = z.object({
  id: idField,
});

export const verifyOtpSchema = z.object({
  id: idField,
  otp: otpField,
});

export const registerSchema = z.object({
  id: idField,
  password: passwordField,
  full_name: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  otp: otpField,
  device_fingerprint: z.string().optional(),
  device_name: z.string().optional(),
});

export const loginSchema = z.object({
  id: idField,
  password: z.string({ message: 'Password is required' }).min(1, 'Password is required'),
  device_fingerprint: z.string().optional(),
  device_name: z.string().optional(),
});

export const googleLoginSchema = z.object({
  idToken: z.string({ message: 'Google ID Token is required' }).min(1),
  device_fingerprint: z.string().optional(),
  device_name: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string({ message: 'Refresh token is required' }).min(1),
});

export const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  avatar_id: z.number().int().min(0).optional(),
  target_exam_id: z.string().uuid().optional().nullable(),
  study_language: z.enum(['en', 'hi', 'both']).optional(),
  prep_level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  daily_study_hours: z.number().min(0).max(24).optional(),
  daily_goal_minutes: z.number().int().min(5).max(480).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

export const forgotPasswordSchema = z.object({
  id: idField,
});

export const resetPasswordSchema = z.object({
  id: idField,
  otp: otpField,
  new_password: passwordField,
});

export const deleteAccountSchema = z.object({
  password: z.string().optional(),
  reason: z.string().max(500).optional(),
});

// ==========================================
// Zod Validation Middleware Helper
// ==========================================

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * Returns 400 with structured error details on failure.
 * Compatible with Zod v4.
 */
export const validate = (schema: z.ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Zod v4 uses z.ZodError which has an `issues` array
      const issues = (result as any).error?.issues || [];
      const errors = issues.map((issue: any) => ({
        field: issue.path?.join('.') || 'unknown',
        message: issue.message || 'Validation error',
      }));

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
