// src/controllers/student/dashboard.controller.ts

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

// ==========================================
// 1. HOME DASHBOARD (BFF - Backend For Frontend)
// ==========================================
export const getHomeDashboard = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;

    // 1. FAST DB LOOKUP: Fetch personal user stats (Cannot be globally cached)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        full_name: true,
        level: true,
        xp_total: true,
        gems: true,
        current_streak: true,
        target_exam_id: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const examId = user.target_exam_id || 'unassigned';

    // 2. FETCH SHARED DATA (Aggressively Cached in Redis)
    const [recommendedTests, currentAffairs, dailyQuests] = await Promise.all([
      // Cache tests specific to the user's selected exam for 10 minutes
      fetchWithVersionedCache('tests', `dashboard:tests:${examId}`, 600, () => {
        if (examId === 'unassigned') return Promise.resolve([]);
        return prisma.testSeries.findMany({
          where: { exam_id: examId, is_active: true, is_published: true },
          take: 3,
          orderBy: { created_at: 'desc' },
          select: { id: true, title: true, type: true, difficulty: true, total_questions: true, duration_minutes: true }
        });
      }),

      // Cache top 5 latest news articles globally for 15 minutes
      fetchWithVersionedCache('articles', 'dashboard:articles:latest', 900, () => {
        return prisma.article.findMany({
          where: { is_hidden: false },
          take: 5,
          orderBy: [{ is_pinned: 'desc' }, { published_at: 'desc' }],
          select: { id: true, title: true, summary: true, image_url: true, source_name: true, published_at: true }
        });
      }),

      // Cache active daily quests globally for 1 hour
      fetchWithVersionedCache('quests', 'dashboard:quests:active', 3600, () => {
        return prisma.questConfig.findMany({
          where: { is_active: true },
          take: 3,
          orderBy: { created_at: 'desc' },
          select: { id: true, title: true, description: true, xp_reward: true, target_count: true }
        });
      })
    ]);

    // Construct the single, unified payload for the mobile app
    res.status(200).json({
      success: true,
      data: {
        user_stats: {
          name: user.full_name,
          level: user.level,
          xp: user.xp_total,
          gems: user.gems,
          streak: user.current_streak,
        },
        recommended_tests: recommendedTests,
        current_affairs: currentAffairs,
        daily_quests: dailyQuests
      }
    });

  } catch (error) {
    console.error('Home Dashboard Error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
};

// ==========================================
// 2. AI INSIGHTS & PERFORMANCE DASHBOARD
// ==========================================
export const getAiInsights = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;

    // Cache the AI insights per user for 30 minutes (recalculated on test submissions anyway)
    const cacheScope = `dashboard:ai_insights:${userId}`;
    const cachedInsights = await CacheService.get<any>('ai-insights', cacheScope);
    
    if (cachedInsights) {
      return res.status(200).json({ success: true, data: cachedInsights });
    }

    // Fetch user's last 10 test attempts to analyze performance
    const recentAttempts = await prisma.testAttempt.findMany({
      where: { user_id: userId, status: 'completed' },
      take: 10,
      orderBy: { submitted_at: 'desc' },
      select: { percentage: true, subject_scores: true }
    });

    if (recentAttempts.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          message: "Take a few tests to generate your AI performance insights!",
          overall_accuracy: 0,
          strengths: [],
          weaknesses: [],
          predicted_score: "N/A"
        }
      });
    }

    // --- Basic AI Analysis Engine (MVP) ---
    let totalAccuracy = 0;
    const subjectAggregates: Record<string, { totalScore: number; count: number }> = {};

    recentAttempts.forEach(attempt => {
      totalAccuracy += Number(attempt.percentage || 0);

      // Analyze subject_scores JSON if it exists (Format: { "Math": 80, "English": 45 })
      if (attempt.subject_scores && typeof attempt.subject_scores === 'object') {
        Object.entries(attempt.subject_scores).forEach(([subject, score]) => {
          if (!subjectAggregates[subject]) subjectAggregates[subject] = { totalScore: 0, count: 0 };
          subjectAggregates[subject].totalScore += Number(score);
          subjectAggregates[subject].count += 1;
        });
      }
    });

    const averageAccuracy = (totalAccuracy / recentAttempts.length).toFixed(1);

    // Calculate averages per subject to find strengths and weaknesses
    const categorizedSubjects = Object.entries(subjectAggregates).map(([subject, data]) => ({
      subject,
      average: data.totalScore / data.count
    }));

    // Sort subjects by average score
    categorizedSubjects.sort((a, b) => b.average - a.average);

    const strengths = categorizedSubjects.filter(c => c.average >= 70).map(c => c.subject);
    const weaknesses = categorizedSubjects.filter(c => c.average < 50).map(c => c.subject);

    const insightsPayload = {
      overall_accuracy: Number(averageAccuracy),
      strengths: strengths.length > 0 ? strengths : ["Keep practicing to find your strengths!"],
      weaknesses: weaknesses.length > 0 ? weaknesses : ["None detected yet. Great job!"],
      predicted_score: `${Math.round(Number(averageAccuracy) * 0.9)} - ${Math.round(Number(averageAccuracy) * 1.1)}%`, // Simple projection
      recommended_focus: weaknesses.length > 0 ? weaknesses[0] : "Mixed Revision"
    };

    // Cache the analyzed data for 30 minutes
    await CacheService.set('ai-insights', cacheScope, insightsPayload, 1800);

    res.status(200).json({ success: true, data: insightsPayload });

  } catch (error) {
    console.error('AI Insights Error:', error);
    res.status(500).json({ error: 'Failed to generate AI insights' });
  }
};
