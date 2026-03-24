// src/controllers/student/home.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import { CacheService } from '../../services/cache.service';

const fetchWithVersionedCache = async <T>(
  tag: string,
  scope: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> => {
  try {
    const cached = await CacheService.get<T>(tag, scope);
    if (cached !== null) return cached;

    const freshData = await fetcher();
    await CacheService.set(tag, scope, freshData, ttlSeconds);
    return freshData;
  } catch (err) {
    console.error(`Versioned Cache Error for tag ${tag} scope ${scope}:`, err);
    // Fallback to database if Redis is temporarily down
    return await fetcher();
  }
};

export const getHomeDashboard = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;

    // 1. Fetch User Data First (Needed for Streak Logic & Recommendations)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        full_name: true,
        avatar_id: true,
        current_streak: true,
        longest_streak: true,
        last_activity_date: true,
        xp_total: true,
        level: true,
        is_premium: true,
        target_exam_id: true
      }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // ==========================================
    // STREAK ENGINE (Auto-Calculates Daily Streak)
    // ==========================================
    const now = new Date();
    // Normalize to midnight to safely compare dates regardless of the exact hour
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let lastActivityDate = user.last_activity_date 
      ? new Date(user.last_activity_date.getFullYear(), user.last_activity_date.getMonth(), user.last_activity_date.getDate()) 
      : null;

    let newStreak = user.current_streak;
    let newLongest = user.longest_streak;
    let needsDbUpdate = false;

    if (!lastActivityDate) {
      // First time opening the app!
      newStreak = 1;
      newLongest = 1;
      needsDbUpdate = true;
    } else {
      const diffTime = Math.abs(today.getTime() - lastActivityDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Active yesterday! Increment streak.
        newStreak += 1;
        if (newStreak > newLongest) newLongest = newStreak;
        needsDbUpdate = true;
      } else if (diffDays > 1) {
        // Missed a day. Reset to 1.
        newStreak = 1;
        needsDbUpdate = true;
      }
      // If diffDays === 0, they already opened the app today. Streak stays the same.
    }

    // Fire-and-forget DB update for streak so we don't slow down the API response!
    if (needsDbUpdate) {
      setImmediate(async () => {
        try {
          await prisma.user.update({
            where: { id: userId },
            data: {
              current_streak: newStreak,
              longest_streak: newLongest,
              last_activity_date: now
            }
          });
        } catch (e) {
          console.error('[Streak Update Error]:', e);
        }
      });
    }

    // ==========================================
    // PARALLEL DATA AGGREGATION (Cached for Instant UI Render)
    // ==========================================
    const [
      dailyQuizzes,
      recommendedTests,
      latestArticles,
      recentPerformance
    ] = await Promise.all([
      // A. Cache globally for 1 hour
      fetchWithVersionedCache('tests', 'home:daily_quizzes', 3600, () => 
        // FIXED: Using `testSeries` instead of `test`
        prisma.testSeries.findMany({
          where: { test_type: 'DAILY_QUIZ', is_published: true },
          take: 2,
          orderBy: { created_at: 'desc' },
          select: { id: true, title: true, total_marks: true, duration_minutes: true }
        })
      ),

      // B. Cache per exam category for 1 hour
      fetchWithVersionedCache(
        'tests',
        `home:recommended_tests:${user.target_exam_id || 'all'}`,
        3600,
        () =>
        // FIXED: Using `testSeries` instead of `test`
        prisma.testSeries.findMany({
          where: { 
            test_type: 'MOCK_TEST', 
            is_published: true,
            ...(user.target_exam_id ? { exam_id: user.target_exam_id } : {}) 
          },
          take: 3,
          orderBy: { created_at: 'desc' },
          // FIXED: Using `type` instead of `is_premium` because schema dictates `type String`
          select: { id: true, title: true, total_marks: true, duration_minutes: true, type: true }
        })
      ),

      // C. Cache globally for 15 minutes (News updates frequently)
      fetchWithVersionedCache('articles', 'home:latest_articles', 900, () => 
        prisma.article.findMany({
          where: { is_hidden: false },
          take: 5,
          orderBy: [{ is_pinned: 'desc' }, { published_at: 'desc' }],
          select: { id: true, title: true, category: true, image_url: true, published_at: true }
        })
      ),

      // D. Cache individually per user for 15 minutes
      fetchWithVersionedCache('recent-performance', `home:recent_performance:${userId}`, 900, () => 
        prisma.testAttempt.findMany({
          where: { user_id: userId, status: 'completed' }, // Status matches submission worker
          take: 3,
          // FIXED: `end_time` -> `submitted_at`
          orderBy: { submitted_at: 'desc' },
          select: { 
            score: true, 
            // FIXED: `accuracy_percentage` -> `percentage`
            percentage: true,
            // FIXED: relation name `test` -> `test_series`
            test_series: { select: { title: true, total_marks: true } }
          }
        })
      )
    ]);

    // Send the beautifully aggregated payload to the mobile app
    res.status(200).json({
      success: true,
      data: {
        user_stats: {
          full_name: user.full_name,
          avatar_id: user.avatar_id,
          current_streak: newStreak, // Send the newly calculated streak instantly
          xp_total: user.xp_total,
          level: user.level,
          is_premium: user.is_premium
        },
        dashboard: {
          daily_quizzes: dailyQuizzes,
          recommended_tests: recommendedTests,
          latest_news: latestArticles,
          performance_trend: recentPerformance
        }
      }
    });

  } catch (error) {
    console.error('Home Dashboard Error:', error);
    res.status(500).json({ error: 'Failed to load home dashboard' });
  }
};
