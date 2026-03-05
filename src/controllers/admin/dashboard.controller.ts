// src/controllers/admin/dashboard.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // Run all count queries concurrently for maximum speed
    const [
      totalStudents,
      activeTests,
      totalQuestions,
      totalAdmins
    ] = await Promise.all([
      prisma.user.count(),
      prisma.testSeries.count({ where: { is_active: true } }),
      prisma.question.count(),
      prisma.adminUser.count({ where: { is_active: true } })
    ]);

    // Get recent signups for a quick snapshot table
    const recentStudents = await prisma.user.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        full_name: true,
        email: true,
        phone_number: true,
        created_at: true
      }
    });

    res.status(200).json({
      metrics: {
        totalStudents,
        activeTests,
        totalQuestions,
        totalAdmins
      },
      recentStudents
    });
  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
};