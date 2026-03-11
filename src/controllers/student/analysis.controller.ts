// src/controllers/student/analysis.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import redisClient from '../../config/redis';

// ==========================================
// 1. GET POST-TEST ANALYSIS (Score, Rank, Weaknesses)
// ==========================================
export const getTestAnalysis = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const userId = (req as any).user.id as string;

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId as string },
      include: { test_series: { select: { title: true, total_marks: true, total_questions: true } } }
    });

    if (!attempt || attempt.user_id !== userId) {
      return res.status(404).json({ error: 'Test attempt not found' });
    }

    if (attempt.status !== 'completed') {
      return res.status(400).json({ error: 'Test is not yet completed' });
    }
    if (attempt.score === null) {
        return res.status(400).json({ error: 'Score not available' });
    }

    // Scalability: Calculate Rank efficiently by counting how many attempts for this test scored higher
    // We cache this specific rank count for 10 minutes to avoid DB strain during peak hours
    const rankCacheKey = `test_rank:${attempt.test_series_id}:${attempt.score}`;
    let rankCount = await redisClient.get(rankCacheKey);

    if (!rankCount) {
      const higherScores = await prisma.testAttempt.count({
        where: {
          test_series_id: attempt.test_series_id,
          status: 'completed',
          score: { gt: attempt.score }
        }
      });
      rankCount = String(higherScores + 1);
      await redisClient.setEx(rankCacheKey, 600, rankCount);
    }

    // Process subject scores to find strengths and weaknesses
    const subjectScores = attempt.subject_scores as Record<string, number> || {};
    const categorizedSubjects = Object.entries(subjectScores).map(([subject, score]) => ({
      subject,
      score
    }));

    categorizedSubjects.sort((a, b) => b.score - a.score);

    res.status(200).json({
      success: true,
      data: {
        test_title: attempt.test_series.title,
        score: attempt.score,
        percentage: attempt.percentage,
        time_taken_seconds: attempt.time_taken_seconds,
        rank: Number(rankCount),
        subject_performance: categorizedSubjects,
        strongest_subject: categorizedSubjects.length > 0 ? categorizedSubjects[0].subject : 'N/A',
        weakest_subject: categorizedSubjects.length > 0 ? categorizedSubjects[categorizedSubjects.length - 1].subject : 'N/A'
      }
    });

  } catch (error) {
    console.error('Get Test Analysis Error:', error);
    res.status(500).json({ error: 'Failed to fetch test analysis' });
  }
};

// ==========================================
// 2. GET TEST REVIEW (Answer Key)
// ==========================================
export const getTestReview = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const userId = (req as any).user.id as string;

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId as string }
    });

    if (!attempt || attempt.user_id !== userId || attempt.status !== 'completed') {
      return res.status(403).json({ error: 'Cannot review an incomplete or unauthorized test' });
    }

    // Fetch original questions
    const rawQuestions = await prisma.question.findMany({
      where: { test_series_id: attempt.test_series_id },
      orderBy: { display_order: 'asc' }
    });

    // CRITICAL: Format for Review Mode
    const reviewQuestions = rawQuestions.map(q => {
      let finalOptions = q.options as any[];

      // PERSONALIZATION APPLIED: Only display the correct option for multiple-choice questions
      if (q.question_type === 'mcq') {
        finalOptions = finalOptions.filter(
          (opt) => opt.id === q.correct_option_id || opt.is_correct === true
        );
      }

      return {
        id: q.id,
        subject: q.subject,
        question_text: q.question_text,
        question_text_hindi: q.question_text_hindi,
        explanation: q.explanation,
        explanation_hindi: q.explanation_hindi,
        correct_option_id: q.correct_option_id,
        options: finalOptions // Will only contain the correct answer
      };
    });

    res.status(200).json({
      success: true,
      data: reviewQuestions
    });

  } catch (error) {
    console.error('Get Test Review Error:', error);
    res.status(500).json({ error: 'Failed to fetch test review' });
  }
};