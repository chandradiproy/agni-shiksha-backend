// src/controllers/admin/gamification.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';

// ==========================================
// QUEST CONFIGURATION
// ==========================================

export const createQuest = async (req: Request, res: Response) => {
  try {
    const { title, description, xp_reward, target_action, target_count, is_active } = req.body;
    const adminId = (req as any).admin?.id as string;

    if (!title || !description || !xp_reward || !target_action || !target_count) {
      return res.status(400).json({ error: 'All core quest fields are required' });
    }

    const quest = await prisma.questConfig.create({
      data: {
        title,
        description,
        xp_reward: Number(xp_reward),
        target_action,
        target_count: Number(target_count),
        is_active: is_active ?? true
      }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'CREATED_QUEST',
        target_id: quest.id,
        details: { title }
      }
    });

    res.status(201).json({ message: 'Quest created successfully', data: quest });
  } catch (error) {
    console.error('Create Quest Error:', error);
    res.status(500).json({ error: 'Failed to create quest' });
  }
};

export const getQuests = async (req: Request, res: Response) => {
  try {
    const quests = await prisma.questConfig.findMany({
      orderBy: { created_at: 'desc' }
    });

    res.status(200).json({ data: quests });
  } catch (error) {
    console.error('Fetch Quests Error:', error);
    res.status(500).json({ error: 'Failed to fetch quests' });
  }
};

// ==========================================
// BADGE CONFIGURATION
// ==========================================

export const createBadge = async (req: Request, res: Response) => {
  try {
    const { badge_name, description, icon_url, unlock_xp_threshold } = req.body;
    const adminId = (req as any).admin?.id as string;

    if (!badge_name || !description || !icon_url || unlock_xp_threshold === undefined) {
      return res.status(400).json({ error: 'All badge fields are required' });
    }

    const badge = await prisma.badgeConfig.create({
      data: {
        badge_name,
        description,
        icon_url,
        unlock_xp_threshold: Number(unlock_xp_threshold)
      }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'CREATED_BADGE',
        target_id: badge.id,
        details: { badge_name }
      }
    });

    res.status(201).json({ message: 'Badge created successfully', data: badge });
  } catch (error) {
    console.error('Create Badge Error:', error);
    res.status(500).json({ error: 'Failed to create badge' });
  }
};

export const getBadges = async (req: Request, res: Response) => {
  try {
    const badges = await prisma.badgeConfig.findMany({
      orderBy: { unlock_xp_threshold: 'asc' } // Show lowest XP requirement first
    });

    res.status(200).json({ data: badges });
  } catch (error) {
    console.error('Fetch Badges Error:', error);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
};