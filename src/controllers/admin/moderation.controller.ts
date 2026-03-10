// src/controllers/admin/moderation.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';

// 1. Fetch doubts with smart filtering and search
export const getModerationDoubts = async (req: Request, res: Response) => {
  try {
    const filter = req.query.filter as string; // 'flagged', 'resolved', 'unresolved', or 'all'
    const search = req.query.search as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Build dynamic where clause
    let whereClause: any = {};

    if (filter === 'flagged') {
      whereClause.is_flagged = true;
    } else if (filter === 'resolved') {
      whereClause.is_resolved = true;
    } else if (filter === 'unresolved') {
      whereClause.is_resolved = false;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
        { subject: { contains: search, mode: 'insensitive' as const } }
      ];
    }

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

// 2. NEW: Update a Doubt's Status (Mark resolved, or remove a false flag)
export const updateDoubtStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_flagged, is_resolved } = req.body;
    const adminId = (req as any).admin.id as string;

    const existingDoubt = await prisma.doubt.findUnique({ where: { id: id as string } });
    if (!existingDoubt) return res.status(404).json({ error: 'Doubt not found' });

    const updatedDoubt = await prisma.doubt.update({
      where: { id: id as string },
      data: {
        is_flagged: is_flagged !== undefined ? Boolean(is_flagged) : undefined,
        is_resolved: is_resolved !== undefined ? Boolean(is_resolved) : undefined,
      }
    });

    // Record this action in the Admin Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'UPDATED_DOUBT_STATUS',
        target_id: id as string,
        details: { is_flagged, is_resolved }
      }
    });

    res.status(200).json({ message: 'Doubt status updated successfully', data: updatedDoubt });
  } catch (error) {
    console.error('Update Doubt Status Error:', error);
    res.status(500).json({ error: 'Failed to update doubt status' });
  }
};

// 3. Permanently delete an inappropriate doubt (cascading deletes its answers)
export const deleteDoubt = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin.id as string;
    
    const existingDoubt = await prisma.doubt.findUnique({ where: { id: id as string } });
    if (!existingDoubt) return res.status(404).json({ error: 'Doubt not found' });

    await prisma.doubt.delete({ where: { id: id as string } });
    
    // Log the deletion
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

// 4. Permanently delete an inappropriate answer
export const deleteDoubtAnswer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin.id as string;

    const existingAnswer = await prisma.doubtAnswer.findUnique({ where: { id: id as string } });
    if (!existingAnswer) return res.status(404).json({ error: 'Answer not found' });

    await prisma.doubtAnswer.delete({ where: { id: id as string } });
    
    // Log the deletion
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'DELETED_DOUBT_ANSWER',
        target_id: id as string,
        details: { answer_preview: existingAnswer.content.substring(0, 50) }
      }
    });

    res.status(200).json({ message: 'Answer deleted successfully' });
  } catch (error) {
    console.error('Delete Answer Error:', error);
    res.status(500).json({ error: 'Failed to delete answer' });
  }
};