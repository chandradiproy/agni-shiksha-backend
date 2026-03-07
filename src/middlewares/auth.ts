// src/middlewares/auth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the JWT
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    // Verify user exists and is not banned
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

    // Attach user ID to request
    (req as any).user = { id: user.id };

    next();
  } catch (error) {
    console.error('Student Auth Middleware Error:', error);
    return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }
};