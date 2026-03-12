// src/controllers/student/social.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import redisClient from '../../config/redis';

// ==========================================
// 1. GET DOUBTS (Cursor-Based Pagination)
// ==========================================
export const getDoubts = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const cursor = req.query.cursor as string; // UUID of the last fetched doubt
    const subject = req.query.subject as string;

    const whereClause: any = {};
    if (subject) whereClause.subject = subject;

    const doubts = await prisma.doubt.findMany({
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), // Skip the cursor itself
      where: whereClause,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        subject: true,
        upvotes: true,
        is_resolved: true,
        created_at: true,
        user: { select: { full_name: true, avatar_id: true } },
        _count: { select: { answers: true } }
      }
    });

    const nextCursor = doubts.length === limit ? doubts[doubts.length - 1].id : null;

    res.status(200).json({
      success: true,
      data: doubts,
      pagination: { nextCursor, limit }
    });
  } catch (error) {
    console.error('Get Doubts Error:', error);
    res.status(500).json({ error: 'Failed to fetch doubts' });
  }
};

// ==========================================
// 2. CREATE A DOUBT
// ==========================================
export const createDoubt = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const { title, description, subject, image_url } = req.body;

    if (!title || !description || !subject) {
      return res.status(400).json({ error: 'Title, description, and subject are required' });
    }

    const doubt = await prisma.doubt.create({
      data: {
        user_id: userId,
        title,
        description,
        subject,
        image_url
      }
    });

    // Fire-and-forget gamification: Reward XP for asking a question
    setImmediate(async () => {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { xp_total: { increment: 10 } }
        });
      } catch (e) {
        console.error('Gamification Update Error:', e);
      }
    });

    res.status(201).json({ success: true, message: 'Doubt posted successfully', data: doubt });
  } catch (error) {
    console.error('Create Doubt Error:', error);
    res.status(500).json({ error: 'Failed to create doubt' });
  }
};

// ==========================================
// 3. GET ANSWERS FOR A DOUBT
// ==========================================
export const getAnswers = async (req: Request, res: Response) => {
  try {
    const { doubtId } = req.params;

    const answers = await prisma.doubtAnswer.findMany({
      where: { doubt_id: doubtId as string },
      orderBy: [{ is_accepted: 'desc' }, { upvotes: 'desc' }, { created_at: 'asc' }],
      select: {
        id: true,
        content: true,
        image_url: true, // Now fully supported by the updated schema
        upvotes: true,
        is_accepted: true,
        created_at: true,
        user: { select: { id: true, full_name: true, avatar_id: true, level: true } }
      }
    });

    res.status(200).json({ success: true, data: answers });
  } catch (error) {
    console.error('Get Answers Error:', error);
    res.status(500).json({ error: 'Failed to fetch answers' });
  }
};

// ==========================================
// 4. POST AN ANSWER
// ==========================================
export const postAnswer = async (req: Request, res: Response) => {
  try {
    const { doubtId } = req.params;
    const userId = (req as any).user.id as string;
    const { content, image_url } = req.body; 

    if (!content) return res.status(400).json({ error: 'Answer content is required' });

    // Ensure the doubt exists
    const doubtExists = await prisma.doubt.findUnique({ where: { id: doubtId as string } });
    if (!doubtExists) return res.status(404).json({ error: 'Doubt not found' });

    const answer = await prisma.doubtAnswer.create({
      data: {
        doubt_id: doubtId as string,
        user_id: userId,
        content,
        image_url // Now fully supported by the updated schema
      }
    });

    // Fire-and-forget Gamification: Answer a question (higher XP reward)
    setImmediate(async () => {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { xp_total: { increment: 20 } }
        });
      } catch (e) { /* ignore silent failure */ }
    });

    res.status(201).json({ success: true, message: 'Answer posted successfully', data: answer });
  } catch (error) {
    console.error('Post Answer Error:', error);
    res.status(500).json({ error: 'Failed to post answer' });
  }
};

// ==========================================
// 5. TOGGLE UPVOTE (Doubt or Answer) - Redis Guarded
// ==========================================
export const toggleUpvote = async (req: Request, res: Response) => {
  try {
    const { targetId } = req.params;
    const { type } = req.body; // 'DOUBT' or 'ANSWER'
    const userId = (req as any).user.id as string;

    if (type !== 'DOUBT' && type !== 'ANSWER') {
      return res.status(400).json({ error: 'Invalid upvote type' });
    }

    // SCALABILITY: Use Redis to prevent duplicate votes without a heavy DB Junction Table!
    // We store a key that lives for 30 days to track if this user upvoted this item.
    const redisKey = `upvote:${type}:${targetId}:${userId}`;
    const alreadyVoted = await redisClient.get(redisKey);

    if (alreadyVoted) {
      // User is UN-VOTING (Removing their upvote)
      await redisClient.del(redisKey);
      
      if (type === 'DOUBT') {
        await prisma.doubt.update({ where: { id: targetId as string }, data: { upvotes: { decrement: 1 } } });
      } else {
        await prisma.doubtAnswer.update({ where: { id: targetId as string }, data: { upvotes: { decrement: 1 } } });
      }

      return res.status(200).json({ success: true, message: 'Upvote removed', action: 'removed' });
    } else {
      // User is UPVOTING (Adding their vote)
      // Cache their vote lock for 30 days (2592000 seconds)
      await redisClient.setEx(redisKey, 2592000, '1');

      if (type === 'DOUBT') {
        await prisma.doubt.update({ where: { id: targetId as string }, data: { upvotes: { increment: 1 } } });
      } else {
        await prisma.doubtAnswer.update({ where: { id: targetId as string }, data: { upvotes: { increment: 1 } } });
      }

      return res.status(200).json({ success: true, message: 'Upvoted successfully', action: 'added' });
    }
  } catch (error) {
    console.error('Toggle Upvote Error:', error);
    res.status(500).json({ error: 'Failed to toggle upvote' });
  }
};

// ==========================================
// 6. REPORT CONTENT (To Admin)
// ==========================================
export const reportContent = async (req: Request, res: Response) => {
  try {
    const { targetId } = req.params;
    const { type, reason } = req.body; // type: 'DOUBT' or 'ANSWER'
    const userId = (req as any).user.id as string;

    if (!reason) return res.status(400).json({ error: 'Reason is required' });

    await prisma.report.create({
      data: {
        item_id: targetId as string, // Now correctly aligned with the updated schema
        item_type: type,
        reason: reason,
        reported_by_user_id: userId
      }
    });

    // Also flag the item automatically for Admin review
    if (type === 'DOUBT') {
      await prisma.doubt.update({ where: { id: targetId as string }, data: { is_flagged: true } });
    } else if (type === 'ANSWER') {
      await prisma.doubtAnswer.update({ where: { id: targetId as string }, data: { is_flagged: true } });
    }

    res.status(200).json({ success: true, message: 'Content reported to administrators' });
  } catch (error) {
    console.error('Report Content Error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
};