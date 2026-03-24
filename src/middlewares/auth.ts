// src/middlewares/auth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import bcrypt from 'bcryptjs';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'fallback_access_secret';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];

    // Verify the JWT — must be an 'access' type token
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as { userId: string; type?: string };

    // Reject refresh tokens being used as access tokens
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({ error: 'Unauthorized: Invalid token type' });
    }

    // Verify user exists, is active, and is not banned
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, is_banned: true, is_active: true }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Unauthorized: Account disabled or deleted' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Forbidden: Account has been suspended for violating terms' });
    }

    // Find the most recent active session for this user (for logout tracking)
    // We do a lightweight check — find ANY active session. We don't match the exact
    // session here because access tokens are short-lived (15 min) and don't carry session IDs.
    // This is a deliberate trade-off: we check sessions on refresh, not on every request.
    const activeSession = await prisma.userSession.findFirst({
      where: {
        user_id: user.id,
        is_active: true,
        expires_at: { gt: new Date() },
      },
      select: { id: true },
      orderBy: { created_at: 'desc' }
    });

    // Attach user ID and session ID to request
    (req as any).user = {
      id: user.id,
      sessionId: activeSession?.id || null,
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized: Token has expired. Please refresh your token.' });
    }
    console.error('Student Auth Middleware Error:', error);
    return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }
};