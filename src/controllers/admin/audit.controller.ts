// src/controllers/admin/audit.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Optional filters for the frontend
    const adminId = req.query.adminId as string;
    const action = req.query.action as string;

    const whereClause: any = {};
    if (adminId) whereClause.admin_id = adminId;
    if (action) whereClause.action = action;

    const [logs, totalCount] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      }),
      prisma.adminAuditLog.count({ where: whereClause })
    ]);

    res.status(200).json({
      data: logs,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Fetch Audit Logs Error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};