// src/middlewares/adminAuth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the JWT
    const decoded = jwt.verify(token, JWT_SECRET) as { adminId: string; role: string };

    // Verify the admin still exists and is active in the database
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: decoded.adminId }
    });

    if (!adminUser || !adminUser.is_active) {
      return res.status(403).json({ error: 'Forbidden: Admin account disabled or deleted' });
    }

    // Attach admin info to request for downstream controllers to use
    (req as any).admin = {
      id: adminUser.id,
      role: adminUser.role,
      email: adminUser.email
    };

    next();
  } catch (error) {
    console.error('Admin Auth Middleware Error:', error);
    return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }
};

// Optional: Role-based Guard (e.g., for Super Admins only)
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const admin = (req as any).admin;
    if (!admin || !allowedRoles.includes(admin.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};