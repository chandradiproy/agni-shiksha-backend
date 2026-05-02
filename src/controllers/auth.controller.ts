// src/controllers/auth.controller.ts

import { Request, Response } from 'express';
import prisma from '../config/db';
import redisClient from '../config/redis';
import { sendEmailOTP } from '../utils/mailer';
import { sendSmsOtp } from '../utils/sms';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as admin from 'firebase-admin';
import { NotificationService } from '../services/notification.service';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error(
    'FATAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in .env. ' +
    'Server will not start with insecure fallback secrets.'
  );
}

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// ==========================================
// TOKEN GENERATION (Access + Refresh Pair)
// ==========================================

const generateAccessToken = (userId: string): string => {
  return jwt.sign({ userId, type: 'access' }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
};

const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

/**
 * Generates an access + refresh token pair and stores the refresh session in the database.
 * Uses the existing UserSession model that was previously unused.
 */
const generateTokenPair = async (userId: string, req: Request) => {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);

  // Hash the refresh token before storing (so even if DB leaks, tokens can't be used)
  const salt = await bcrypt.genSalt(10);
  const tokenHash = await bcrypt.hash(refreshToken, salt);

  // Enforce: 1 active session at a time
  // Find oldest active session and revoke it, then notify that device via FCM
  const existingSession = await prisma.userSession.findFirst({
    where: { user_id: userId, is_active: true, expires_at: { gt: new Date() } },
    orderBy: { created_at: 'asc' },
    include: { user: { select: { device_tokens: true } } }
  });

  if (existingSession) {
    // 1. Revoke old session
    await prisma.userSession.update({
      where: { id: existingSession.id },
      data: { is_active: false }
    });

    // 2. Send FCM silent push to old device
    const oldTokens = existingSession.user?.device_tokens as string[] || [];
    if (oldTokens.length > 0) {
      setImmediate(() =>
        NotificationService.sendSessionEvictedNotification(oldTokens, userId)
      );
    }
  }

  // Store session directly (removed setImmediate to avoid race condition)
  try {
    await prisma.userSession.create({
      data: {
        user_id: userId,
        jwt_token_hash: tokenHash,
        device_fingerprint: req.body.device_fingerprint || 'unknown',
        device_name: req.body.device_name || null,
        ip_address: req.ip || req.socket.remoteAddress || 'unknown',
        user_agent: req.headers['user-agent'] || null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    });
  } catch (e) {
    console.error('[Session Create Error]:', e);
  }

  return { accessToken, refreshToken };
};

const isEmail = (id: string) => id.includes('@');

// ==========================================
// HELPER: Generate & Send OTP
// ==========================================
const generateAndSendOtp = async (id: string): Promise<void> => {
  const cooldownKey = `otp_cooldown:${id}`;
  const onCooldown = await redisClient.exists(cooldownKey);
  if (onCooldown) {
    throw { status: 429, message: 'Please wait 60 seconds before requesting another OTP.' };
  }
  await redisClient.setEx(cooldownKey, 60, '1');

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Save to Redis for 5 minutes
  await redisClient.setEx(`otp:${id}`, 300, otp);

  if (isEmail(id)) {
    await sendEmailOTP(id, otp);
  } else {
    await sendSmsOtp(id, otp);
  }
};

// ==========================================
// 1. REQUEST OTP (For Login OR Registration)
// ==========================================
export const requestOtp = async (req: Request, res: Response) => {
  try {
    const { id } = req.body;

    await generateAndSendOtp(id);

    res.status(200).json({ success: true, message: 'OTP sent successfully' });
  } catch (error: any) {
    if (error.status === 429) {
      return res.status(429).json({ error: error.message });
    }
    console.error('Request OTP Error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

// ==========================================
// 2. REGISTER NEW USER (Requires OTP)
// ==========================================
export const register = async (req: Request, res: Response) => {
  try {
    const { id, password, full_name, otp } = req.body;

    const attemptKey = `otp_attempts:${id}`;
    const attempts = parseInt(await redisClient.get(attemptKey) || '0');
    if (attempts >= 5) {
      return res.status(429).json({
        error: 'Too many failed attempts. Please request a new OTP.',
        retry_after_seconds: await redisClient.ttl(attemptKey)
      });
    }

    // Verify OTP
    const storedOtp = await redisClient.get(`otp:${id}`);
    if (!storedOtp || storedOtp !== otp) {
      await redisClient.setEx(attemptKey, 600, (attempts + 1).toString());
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    await redisClient.del(attemptKey);

    // Check if user already exists
    const idQuery = isEmail(id) ? { email: id } : { phone_number: id };
    const existingUser = await prisma.user.findUnique({ where: idQuery });

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this ID already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        ...idQuery,
        full_name,
        password_hash,
      }
    });

    await redisClient.del(`otp:${id}`); // Clean up OTP

    const tokens = await generateTokenPair(user.id, req);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        avatar_id: user.avatar_id,
        level: user.level,
        xp_total: user.xp_total,
        is_premium: user.is_premium,
        onboarding_completed: user.onboarding_completed
      }
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

// ==========================================
// 3. LOGIN WITH ID & PASSWORD
// ==========================================
export const loginWithPassword = async (req: Request, res: Response) => {
  try {
    const { id, password } = req.body;

    const idQuery = isEmail(id) ? { email: id } : { phone_number: id };
    const user = await prisma.user.findUnique({ where: idQuery });

    if (!user || !user.password_hash) {
      return res.status(400).json({ error: 'Invalid credentials or user registered via Google/OTP' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account has been deactivated' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Account has been suspended' });
    }

    const lockKey  = `login_lock:${user.id}`;
    const failKey  = `login_fail:${user.id}`;
    const isLocked = await redisClient.exists(lockKey);
    if (isLocked) {
      const ttl = await redisClient.ttl(lockKey);
      return res.status(423).json({
        error: `Account temporarily locked. Try again in ${Math.ceil(ttl / 60)} minute(s).`
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const fails = parseInt(await redisClient.get(failKey) || '0') + 1;
      if (fails >= 5) {
        await redisClient.setEx(lockKey, 900, '1'); // 15 min lock
        await redisClient.del(failKey);
      } else {
        await redisClient.setEx(failKey, 900, fails.toString());
      }
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    await redisClient.del(failKey);

    const tokens = await generateTokenPair(user.id, req);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        avatar_id: user.avatar_id,
        level: user.level,
        xp_total: user.xp_total,
        is_premium: user.is_premium,
        onboarding_completed: user.onboarding_completed
      }
    });
  } catch (error) {
    console.error('Password Login Error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

// ==========================================
// 4. PASSWORDLESS LOGIN (OTP Verify)
// ==========================================
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { id, otp } = req.body;

    const attemptKey = `otp_attempts:${id}`;
    const attempts = parseInt(await redisClient.get(attemptKey) || '0');
    if (attempts >= 5) {
      return res.status(429).json({
        error: 'Too many failed attempts. Please request a new OTP.',
        retry_after_seconds: await redisClient.ttl(attemptKey)
      });
    }

    const storedOtp = await redisClient.get(`otp:${id}`);
    if (!storedOtp || storedOtp !== otp) {
      await redisClient.setEx(attemptKey, 600, (attempts + 1).toString());
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    await redisClient.del(attemptKey);

    const idQuery = isEmail(id) ? { email: id } : { phone_number: id };

    // Upsert creates the user if they don't exist, logs them in if they do
    const user = await prisma.user.upsert({
      where: idQuery,
      update: {},
      create: idQuery,
    });

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account has been deactivated' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Account has been suspended' });
    }

    await redisClient.del(`otp:${id}`);

    const tokens = await generateTokenPair(user.id, req);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        avatar_id: user.avatar_id,
        level: user.level,
        xp_total: user.xp_total,
        is_premium: user.is_premium,
        onboarding_completed: user.onboarding_completed
      }
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

// ==========================================
// 5. GOOGLE LOGIN
// ==========================================
export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid Google Token' });

    const user = await prisma.user.upsert({
      where: { email: payload.email },
      update: {},
      create: {
        email: payload.email,
        full_name: payload.name,
      },
    });

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account has been deactivated' });
    }

    const tokens = await generateTokenPair(user.id, req);

    res.status(200).json({
      success: true,
      message: 'Google Login successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        avatar_id: user.avatar_id,
        level: user.level,
        xp_total: user.xp_total,
        is_premium: user.is_premium,
        onboarding_completed: user.onboarding_completed
      }
    });
  } catch (error) {
    console.error('Google Login Error:', error);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
};

// ==========================================
// 6. REFRESH TOKEN
// ==========================================
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken: oldRefreshToken } = req.body;

    // 1. Verify the refresh JWT signature and expiry
    let decoded: { userId: string; type: string };
    try {
      decoded = jwt.verify(oldRefreshToken, JWT_REFRESH_SECRET) as { userId: string; type: string };
    } catch {
      return res.status(401).json({ error: 'Refresh token is invalid or expired' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // 2. Find all active sessions for this user and check if this refresh token matches one
    const activeSessions = await prisma.userSession.findMany({
      where: {
        user_id: decoded.userId,
        is_active: true,
        expires_at: { gt: new Date() },
      }
    });

    let matchedSession = null;
    for (const session of activeSessions) {
      const isMatch = await bcrypt.compare(oldRefreshToken, session.jwt_token_hash);
      if (isMatch) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      return res.status(401).json({ error: 'Session not found or already revoked' });
    }

    // 3. Invalidate the old session (rotation — each refresh token is single-use)
    await prisma.userSession.update({
      where: { id: matchedSession.id },
      data: { is_active: false }
    });

    // 4. Generate new token pair
    const tokens = await generateTokenPair(decoded.userId, req);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    console.error('Refresh Token Error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};

// ==========================================
// 7. LOGOUT (Single Session)
// ==========================================
export const logout = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const sessionId = (req as any).user.sessionId as string;

    if (sessionId) {
      await prisma.userSession.update({
        where: { id: sessionId },
        data: { is_active: false }
      });
    }

    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
};

// ==========================================
// 8. LOGOUT ALL (Revoke All Sessions)
// ==========================================
export const logoutAll = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;

    const result = await prisma.userSession.updateMany({
      where: { user_id: userId, is_active: true },
      data: { is_active: false }
    });

    res.status(200).json({
      success: true,
      message: `Logged out from ${result.count} session(s)`,
      sessions_revoked: result.count,
    });
  } catch (error) {
    console.error('Logout All Error:', error);
    res.status(500).json({ error: 'Failed to logout from all devices' });
  }
};

// ==========================================
// 9. GET CURRENT USER PROFILE
// ==========================================
export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone_number: true,
        full_name: true,
        avatar_id: true,
        target_exam_id: true,
        is_premium: true,
        premium_plan_id: true,
        premium_expires_at: true,
        xp_total: true,
        gems: true,
        level: true,
        current_streak: true,
        longest_streak: true,
        last_activity_date: true,
        is_active: true,
        onboarding_completed: true,
        referral_code: true,
        daily_goal_minutes: true,
        study_language: true,
        created_at: true,
        // Explicitly excluded: password_hash, is_banned (internal), deleted_at
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// ==========================================
// 10. UPDATE USER PROFILE
// ==========================================
export const updateMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;

    // Only allow updating specific safe fields
    const allowedFields: Record<string, any> = {};
    const updatableFields = ['full_name', 'avatar_id', 'target_exam_id', 'study_language', 'prep_level', 'daily_study_hours', 'daily_goal_minutes'];

    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        allowedFields[field] = req.body[field];
      }
    }

    if (Object.keys(allowedFields).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    // Validate target_exam_id FK exists before attempting update
    if (allowedFields.target_exam_id) {
      const examExists = await prisma.exam.findUnique({
        where: { id: allowedFields.target_exam_id },
        select: { id: true },
      });
      if (!examExists) {
        return res.status(400).json({ error: 'Invalid target exam — the selected exam does not exist' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: allowedFields,
      select: {
        id: true,
        email: true,
        phone_number: true,
        full_name: true,
        avatar_id: true,
        target_exam_id: true,
        study_language: true,
        daily_goal_minutes: true,
        is_premium: true,
        xp_total: true,
        level: true,
        gems: true,
        current_streak: true,
        longest_streak: true,
        onboarding_completed: true,
      }
    });

    res.status(200).json({ success: true, message: 'Profile updated successfully', data: updatedUser });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// ==========================================
// 11. FORGOT PASSWORD (Send OTP)
// ==========================================
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.body;

    // Verify user exists
    const idQuery = isEmail(id) ? { email: id } : { phone_number: id };
    const user = await prisma.user.findUnique({ where: idQuery });

    if (!user) {
      // Return success even if user doesn't exist (prevents user enumeration)
      return res.status(200).json({ success: true, message: 'If an account exists, an OTP has been sent' });
    }

    await generateAndSendOtp(id);

    res.status(200).json({ success: true, message: 'If an account exists, an OTP has been sent' });
  } catch (error: any) {
    if (error.status === 429) {
      return res.status(429).json({ error: error.message });
    }
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Failed to process forgot password request' });
  }
};

// ==========================================
// 12. RESET PASSWORD (Verify OTP + Set New Password)
// ==========================================
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { id, otp, new_password } = req.body;

    const attemptKey = `otp_attempts:${id}`;
    const attempts = parseInt(await redisClient.get(attemptKey) || '0');
    if (attempts >= 5) {
      return res.status(429).json({
        error: 'Too many failed attempts. Please request a new OTP.',
        retry_after_seconds: await redisClient.ttl(attemptKey)
      });
    }

    // Verify OTP
    const storedOtp = await redisClient.get(`otp:${id}`);
    if (!storedOtp || storedOtp !== otp) {
      await redisClient.setEx(attemptKey, 600, (attempts + 1).toString());
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    await redisClient.del(attemptKey);

    // Find user
    const idQuery = isEmail(id) ? { email: id } : { phone_number: id };
    const user = await prisma.user.findUnique({ where: idQuery });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password and update
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);

    await prisma.$transaction([
      // 1. Update password
      prisma.user.update({
        where: { id: user.id },
        data: { password_hash }
      }),
      // 2. Invalidate ALL sessions for security
      prisma.userSession.updateMany({
        where: { user_id: user.id, is_active: true },
        data: { is_active: false }
      })
    ]);

    await redisClient.del(`otp:${id}`);

    res.status(200).json({ success: true, message: 'Password reset successful. Please login with your new password.' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

// ==========================================
// 13. DELETE ACCOUNT (GDPR Soft-Delete)
// ==========================================
export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;

    // If user has a password, optionally verify it for security
    if (req.body.password) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { password_hash: true } });
      if (user?.password_hash) {
        const isMatch = await bcrypt.compare(req.body.password, user.password_hash);
        if (!isMatch) {
          return res.status(400).json({ error: 'Incorrect password' });
        }
      }
    }

    await prisma.$transaction([
      // 1. Soft-delete the user
      prisma.user.update({
        where: { id: userId },
        data: {
          is_active: false,
          deleted_at: new Date(),
          device_tokens: [], // Clear push notification tokens
          device_fingerprints: [],
        }
      }),
      // 2. Invalidate all sessions
      prisma.userSession.updateMany({
        where: { user_id: userId, is_active: true },
        data: { is_active: false }
      })
    ]);

    res.status(200).json({ success: true, message: 'Account deleted successfully. Data will be permanently purged after 30 days.' });
  } catch (error) {
    console.error('Delete Account Error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};

// ==========================================
// 14. PUSH NOTIFICATIONS (FCM)
// ==========================================
export const updateFcmToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const userId = (req as any).user.id;
    if (!token) return res.status(400).json({ error: 'FCM token required' });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { device_tokens: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let tokens = (user.device_tokens as string[]) || [];
    if (!tokens.includes(token)) {
      tokens.push(token);
    }

    if (tokens.length > 5) tokens = tokens.slice(tokens.length - 5);

    await prisma.user.update({
      where: { id: userId },
      data: { device_tokens: tokens }
    });
    await NotificationService.subscribeTokenToGlobalTopic(token);

    res.json({ success: true, message: 'FCM token registered' });
  } catch (err) {
    console.error('Update FCM Token error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const testPushNotification = async (req: Request, res: Response) => {
  try {
    const { pushType, userId } = req.body; 
    if (!pushType || !userId) return res.status(400).json({ error: 'pushType and userId required' });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { device_tokens: true } });
    if (!user || !user.device_tokens || (user.device_tokens as string[]).length === 0) {
      return res.status(400).json({ error: 'User has no registered FCM tokens' });
    }

    const tokens = user.device_tokens as string[];

    const message: admin.messaging.MulticastMessage = {
      tokens,
      data: {
        type: pushType === 'silent' ? 'CACHE_INVALIDATE' : 'INFO',
        target: 'home_dashboard'
      },
      notification: pushType === 'alert' ? {
        title: 'New Content Arrived! 🎉',
        body: 'Pull to refresh or tap to view the latest recommended tests.'
      } : undefined,
      android: { priority: 'high' }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    res.json({ success: true, response, message: `Sent ${pushType} push to ${tokens.length} devices.` });
  } catch (err) {
    console.error('Test Push Error:', err);
    res.status(500).json({ error: 'Failed to send test push.' });
  }
};

/**
 * LIGHTWEIGHT SESSION CHECK
 * Used by mobile app to check if their fingerprint is still the "active" one
 * without requiring full JWT auth if they just want to know status.
 */
export const getSessionStatus = async (req: Request, res: Response) => {
  try {
    const fingerprint = req.headers['x-device-fingerprint'] as string || req.query.fingerprint as string;
    const userId = req.query.userId as string;

    if (!fingerprint || !userId) {
      return res.status(400).json({ error: 'fingerprint and userId required' });
    }

    const activeSession = await prisma.userSession.findFirst({
      where: { 
        user_id: userId, 
        is_active: true, 
        expires_at: { gt: new Date() } 
      },
      select: { device_fingerprint: true }
    });

    if (!activeSession) {
      return res.json({ status: 'no_session', is_active: false });
    }

    const isMatch = activeSession.device_fingerprint === fingerprint;
    res.json({ 
      status: isMatch ? 'active' : 'evicted', 
      is_active: isMatch 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check session status' });
  }
};
