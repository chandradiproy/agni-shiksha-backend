// src/controllers/admin/user.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import { id } from 'zod/v4/locales';
import { equal } from 'node:assert';

// Get all students (with optional search and pagination)
export const getAllStudents = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = (req.query.search as string) || '';
    const skip = (page - 1) * limit;

    // Build the search query
    const whereClause = search ? {
      OR: [
        {id: {equals: search} },  
        { full_name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { phone_number: { contains: search } }, 
      ]
    } : {};

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        // REPLACE 'select' with 'include' to fetch ALL base fields + relations
        include: {
          target_exam: { 
            select: { id: true, name: true, category: true } 
          },
          _count: {
            select: {
              test_attempts: true,
              doubts: true,
              doubt_answers: true,
              reports_made: true
            }
          }
        }
      }),
      prisma.user.count({ where: whereClause })
    ]);

    res.status(200).json({
      data: users,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get All Students Error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};

// Toggle Ban Status for a Student
export const toggleBanStudent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { ban_reason } = req.body;
    const adminId = (req as any).admin?.id as string;

    const user = await prisma.user.findUnique({ where: { id : id as string} });
    if (!user) return res.status(404).json({ error: 'Student not found' });

    const newBanStatus = !user.is_banned;

    const updatedUser = await prisma.user.update({
      where: { id: id as string },
      data: {
        is_banned: newBanStatus,
        ban_reason: newBanStatus ? ban_reason : null, // Clear reason if unbanning
      },
      select: { id: true, is_banned: true, ban_reason: true, email: true }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: newBanStatus ? 'BANNED_USER' : 'UNBANNED_USER',
        target_id: id as string,
        details: { reason: newBanStatus ? ban_reason : null }
      }
    });

    res.status(200).json({ 
      message: `Student ${newBanStatus ? 'banned' : 'unbanned'} successfully`, 
      user: updatedUser 
    });
  } catch (error) {
    console.error('Toggle Ban Student Error:', error);
    res.status(500).json({ error: 'Failed to update student ban status' });
  }
};

// Toggle Forum Access for a Student
export const toggleForumBan = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const adminId = (req as any).admin?.id as string;

    const user = await prisma.user.findUnique({ where: { id: userId  as string } });
    if (!user) return res.status(404).json({ error: 'Student not found' });

    const newStatus = !user.forum_banned;

    const updatedUser = await prisma.user.update({
      where: { id: userId as string },
      data: { forum_banned: newStatus },
      select: { id: true, forum_banned: true, email: true }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: newStatus ? 'FORUM_BANNED_USER' : 'FORUM_UNBANNED_USER',
        target_id: userId as string
      }
    });

    res.status(200).json({ 
      message: `Student forum access ${newStatus ? 'revoked' : 'restored'} successfully`, 
      user: updatedUser 
    });
  } catch (error) {
    console.error('Toggle Forum Ban Error:', error);
    res.status(500).json({ error: 'Failed to update student forum access' });
  }
};

// Revoke ALL active JWT Refresh Token Sessions globally for a compromised user
export const revokeAllUserSessions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin?.id as string;

    const user = await prisma.user.findUnique({ where: { id: id as string } });
    if (!user) return res.status(404).json({ error: 'Student not found' });

    // Hardware/Token Security: Forcefully expire all sessions in the DB
    const deletedSessions = await prisma.userSession.deleteMany({
      where: { user_id: id as string }
    });

    // Optional Security Measure: Nullify FCM Token arrays if needed
    // await prisma.user.update({ where: { id }, data: { device_tokens: [] } });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'REVOKED_SESSIONS',
        target_id: id as string,
        details: { sessions_terminated: deletedSessions.count }
      }
    });

    res.status(200).json({ 
      message: `Successfully revoked ${deletedSessions.count} active sessions for this student. They will be logged out globally.` 
    });
  } catch (error) {
    console.error('Revoke Sessions Error:', error);
    res.status(500).json({ error: 'Failed to globally revoke user sessions.' });
  }
};