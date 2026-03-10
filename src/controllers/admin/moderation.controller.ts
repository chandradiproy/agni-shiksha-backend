// src/controllers/admin/moderation.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';

// Fetch doubts, optionally prioritizing/filtering flagged ones
export const getModerationDoubts = async (req: Request, res: Response) => {
  try {
    const filter = req.query.filter as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const whereClause = filter === 'flagged' ? { is_flagged: true } : {};

    const [doubts, totalCount] = await Promise.all([
      prisma.doubt.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [{ is_flagged: 'desc' }, { created_at: 'desc' }],
        include: {
          user: { select: { id: true, full_name: true, email: true } },
          _count: { select: { answers: true } }
        }
      }),
      prisma.doubt.count({ where: whereClause })
    ]);

    res.status(200).json({
      data: doubts,
      pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) }
    });
  } catch (error) {
    console.error('Fetch Moderation Doubts Error:', error);
    res.status(500).json({ error: 'Failed to fetch doubts for moderation' });
  }
};

// Permanently delete an inappropriate doubt (cascading deletes its answers)
export const deleteDoubt = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin?.id as string;
    
    // Check if it exists
    const existingDoubt = await prisma.doubt.findUnique({ where: { id: id as string } });
    if (!existingDoubt) return res.status(404).json({ error: 'Doubt not found' });

    await prisma.doubt.delete({ where: { id : id as string } });
    
    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'DELETED_DOUBT',
        target_id: id as string,
        details: { doubt_title: existingDoubt.title }
      }
    });

    res.status(200).json({ message: 'Doubt and its associated answers deleted successfully' });
  } catch (error) {
    console.error('Delete Doubt Error:', error);
    res.status(500).json({ error: 'Failed to delete doubt' });
  }
};

// Permanently delete an inappropriate answer
export const deleteDoubtAnswer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin?.id as string;

    const existingAnswer = await prisma.doubtAnswer.findUnique({ where: { id : id as string} });
    if (!existingAnswer) return res.status(404).json({ error: 'Answer not found' });

    await prisma.doubtAnswer.delete({ where: { id : id as string} });
    
    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'DELETED_DOUBT_ANSWER',
        target_id: id as string,
        details: { doubt_id: existingAnswer.doubt_id }
      }
    });

    res.status(200).json({ message: 'Answer deleted successfully' });
  } catch (error) {
    console.error('Delete Answer Error:', error);
    res.status(500).json({ error: 'Failed to delete answer' });
  }
};