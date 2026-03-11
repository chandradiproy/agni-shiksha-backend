// src/controllers/student/gamification.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import redisClient from '../../config/redis';

// ==========================================
// 1. GET LEADERBOARD (Highly Scalable)
// ==========================================
export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const cacheKey = 'global_leaderboard_top_100';
    
    // 1. Try to serve from memory instantly
    const cachedLeaderboard = await redisClient.get(cacheKey);
    if (cachedLeaderboard) {
      return res.status(200).json({ success: true, data: JSON.parse(cachedLeaderboard) });
    }

    // 2. If cache expires, query the DB
    const topUsers = await prisma.user.findMany({
      where: { is_banned: false },
      take: 100,
      orderBy: { xp_total: 'desc' },
      select: {
        id: true,
        full_name: true,
        avatar_id: true,
        level: true,
        xp_total: true,
      }
    });

    // 3. Cache the result for 5 minutes
    // This protects the database! If 10,000 users check the leaderboard, 
    // it only hits the database ONCE every 5 minutes.
    await redisClient.setEx(cacheKey, 300, JSON.stringify(topUsers));

    res.status(200).json({
      success: true,
      data: topUsers
    });

  } catch (error) {
    console.error('Get Leaderboard Error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
};

// ==========================================
// 2. GET MY GAMIFICATION STATS & BADGES
// ==========================================
export const getGamificationProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;

    const [user, allBadges] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { xp_total: true, level: true, gems: true, current_streak: true, longest_streak: true }
      }),
      prisma.badgeConfig.findMany({
        orderBy: { unlock_xp_threshold: 'asc' }
      })
    ]);

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Determine which badges the user has unlocked based on their XP
    const badges = allBadges.map(badge => ({
      ...badge,
      is_unlocked: user.xp_total >= badge.unlock_xp_threshold
    }));

    res.status(200).json({
      success: true,
      data: {
        stats: user,
        badges: badges
      }
    });

  } catch (error) {
    console.error('Get Gamification Profile Error:', error);
    res.status(500).json({ error: 'Failed to fetch gamification profile' });
  }
};