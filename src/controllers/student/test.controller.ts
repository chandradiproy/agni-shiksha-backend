// src/controllers/student/test.controller.ts

import { Request, Response } from 'express';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../../config/db';
import redisClient from '../../config/redis'; // Added for caching

// Create a dedicated IORedis connection specifically for BullMQ.
// BullMQ requires native IORedis for blocking operations. It cannot use the REST Proxy.
const queueConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null // Strictly required by BullMQ
});

export const submissionQueue = new Queue('test-submissions', { 
  connection: queueConnection as any // Type assertion to satisfy BullMQ's expected connection type
});

// ==========================================
// 1. GET AVAILABLE TESTS
// ==========================================
export const getAvailableTests = async (req: Request, res: Response) => {
  try {
    const { examId, type } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      is_active: true,
      is_published: true,
    };

    if (examId) whereClause.exam_id = examId as string;
    if (type) whereClause.type = type as string;

    const [tests, totalCount] = await Promise.all([
      prisma.testSeries.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          title: true,
          type: true,
          test_type: true,
          difficulty: true,
          total_questions: true,
          duration_minutes: true,
          total_marks: true,
          available_from: true,
          available_until: true,
        }
      }),
      prisma.testSeries.count({ where: whereClause })
    ]);

    res.status(200).json({
      success: true,
      data: tests,
      pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) }
    });
  } catch (error) {
    console.error('Get Available Tests Error:', error);
    res.status(500).json({ error: 'Failed to fetch available tests' });
  }
};

// ==========================================
// 2. GET TEST DETAILS & PREVIOUS ATTEMPTS
// ==========================================
export const getTestDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id as string;

    const testSeries = await prisma.testSeries.findUnique({
      where: { id: id as string, is_active: true, is_published: true },
    });

    if (!testSeries) {
      return res.status(404).json({ error: 'Test Series not found or unavailable' });
    }

    // Check how many times the user has already attempted this test
    const previousAttempts = await prisma.testAttempt.findMany({
      where: { test_series_id: testSeries.id, user_id: userId },
      orderBy: { started_at: 'desc' },
      select: { id: true, status: true, score: true, percentage: true, started_at: true }
    });

    res.status(200).json({
      success: true,
      data: {
        test_info: testSeries,
        attempts: previousAttempts,
        can_attempt: previousAttempts.length < testSeries.max_attempts
      }
    });
  } catch (error) {
    console.error('Get Test Details Error:', error);
    res.status(500).json({ error: 'Failed to fetch test details' });
  }
};

// ==========================================
// 3. START A TEST
// ==========================================
export const startTest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id as string;

    const testSeries = await prisma.testSeries.findUnique({
      where: { id: id as string }
    });

    if (!testSeries || !testSeries.is_active || !testSeries.is_published) {
      return res.status(404).json({ error: 'Test Series is not available' });
    }

    // Check Max Attempts
    const attemptCount = await prisma.testAttempt.count({
      where: { test_series_id: testSeries.id, user_id: userId }
    });

    if (attemptCount >= testSeries.max_attempts) {
      return res.status(403).json({ error: 'Maximum attempts reached for this test' });
    }

    // Check for an already 'in_progress' attempt to resume
    let attempt = await prisma.testAttempt.findFirst({
      where: { test_series_id: testSeries.id, user_id: userId, status: 'in_progress' }
    });

    // If no active attempt, create a new one
    if (!attempt) {
      attempt = await prisma.testAttempt.create({
        data: {
          user_id: userId,
          test_series_id: testSeries.id,
          status: 'in_progress',
          score: 0,
          percentage: 0,
          attempt_number: attemptCount + 1 // FIX: Added the missing attempt_number field required by Prisma
        }
      });
    }

    // Fetch Questions
    const rawQuestions = await prisma.question.findMany({
      where: { test_series_id: testSeries.id },
      orderBy: { display_order: 'asc' }
    });

    // CRITICAL FIX: Map questions securely. 
    // We MUST remove `is_correct` and `correct_option_id` from the payload so tech-savvy students can't cheat!
    const secureQuestions = rawQuestions.map((q) => {
      // Map options to explicitly omit the 'is_correct' flag
      const secureOptions = (q.options as any[]).map(opt => ({
        id: opt.id,
        text: opt.text
      }));

      return {
        id: q.id,
        subject: q.subject,
        topic: q.topic,
        section: q.section,
        question_type: q.question_type,
        question_text: q.question_text,
        question_text_hindi: q.question_text_hindi,
        marks: q.marks,
        options: secureOptions
      };
    });

    res.status(200).json({
      success: true,
      data: {
        attempt_id: attempt.id,
        duration_minutes: testSeries.duration_minutes,
        questions: secureQuestions
      }
    });

  } catch (error) {
    console.error('Start Test Error:', error);
    res.status(500).json({ error: 'Failed to start test' });
  }
};

// ==========================================
// 4. SUBMIT TEST (Highly Scalable Engine)
// ==========================================
// 4. SUBMIT TEST (Ultimate BullMQ Scalable Engine)
// ==========================================
export const submitTest = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const { answers, time_taken_seconds } = req.body; 
    const userId = (req as any).user.id as string;

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId as string },
      include: { test_series: true }
    });

    if (!attempt || attempt.user_id !== userId) {
      return res.status(404).json({ error: 'Test attempt not found' });
    }

    if (attempt.status === 'completed') {
      return res.status(400).json({ error: 'This test attempt has already been submitted.' });
    }

    const testSeries = attempt.test_series;

    // SCALABILITY FIX 1: Fetch Answer Key from Redis Cache
    const cacheKey = `test_answer_key:${testSeries.id}`;
    let cachedData = await redisClient.get(cacheKey);
    let questions;

    if (cachedData) {
      questions = JSON.parse(cachedData);
    } else {
      questions = await prisma.question.findMany({
        where: { test_series_id: testSeries.id }
      });
      await redisClient.setEx(cacheKey, 7200, JSON.stringify(questions));
    }

    // Scoring Variables
    let totalScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    const subjectScores: Record<string, number> = {};

    const questionsMap = new Map(questions.map((q: any) => [q.id, q]));

    // Grade each answer in memory (blazing fast - takes < 1ms)
    answers.forEach((ans: any) => {
      // FIX: Explicitly cast 'q' to 'any' so TypeScript knows it contains the properties parsed from Redis
      const q: any = questionsMap.get(ans.question_id);
      if (!q) return;

      if (!subjectScores[q.subject]) subjectScores[q.subject] = 0;

      if (ans.selected_option_id === q.correct_option_id) {
        totalScore += Number(q.marks);
        subjectScores[q.subject] += Number(q.marks);
        correctCount++;
      } else if (ans.selected_option_id) { 
        incorrectCount++;
        if (testSeries.negative_marking && testSeries.negative_marks_per_wrong) {
          totalScore -= Number(testSeries.negative_marks_per_wrong);
          subjectScores[q.subject] -= Number(testSeries.negative_marks_per_wrong);
        }
      }
    });

    const finalScore = Math.max(0, totalScore);
    const percentage = (finalScore / testSeries.total_marks) * 100;

    // ========================================================
    // SCALABILITY FIX 2 & 3: BULLMQ OFF-LOADING
    // We instantly push all Database writes to the Queue and 
    // respond to the user without waiting for the DB to lock!
    // ========================================================
    await submissionQueue.add('process-submission', {
      attemptId,
      userId,
      finalScore,
      percentage: Number(percentage.toFixed(2)),
      subjectScores,
      timeTakenSeconds: time_taken_seconds || 0
    }, {
      removeOnComplete: true, // Keep Redis clean
      attempts: 3,            // Retry if DB temporarily locks
      backoff: { type: 'exponential', delay: 2000 }
    });

    // Immediately return the memory-graded score back to the frontend
    // We use HTTP 202 (Accepted) to indicate the job is processing securely in the background
    res.status(202).json({
      success: true,
      message: 'Test submitted and is being securely saved',
      data: {
        score: finalScore,
        percentage: Number(percentage.toFixed(2)),
        correct_count: correctCount,
        incorrect_count: incorrectCount
      }
    });

  } catch (error) {
    console.error('Submit Test Error:', error);
    res.status(500).json({ error: 'Failed to submit test' });
  }
};