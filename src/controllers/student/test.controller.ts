// src/controllers/student/test.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';

// 1. DISCOVERY: Get active exams for the student to browse
export const getAvailableExams = async (req: Request, res: Response) => {
  try {
    const exams = await prisma.exam.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' },
      select: { id: true, name: true, slug: true, category: true, thumbnail_url: true } // Exclude admin metadata
    });
    res.status(200).json({ data: exams });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
};

// 2. DISCOVERY: Get active, published mock tests for a specific exam
export const getAvailableTestSeries = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    
    const tests = await prisma.testSeries.findMany({
      where: { 
        exam_id: examId as string,
        is_active: true,
        is_published: true // CRUCIAL: Never show drafts to students
      },
      orderBy: { created_at: 'desc' },
      select: { // Send only what the mobile UI needs for the list view
        id: true, title: true, type: true, test_type: true, subject: true,
        total_questions: true, duration_minutes: true, total_marks: true, difficulty: true,
        is_scheduled: true, scheduled_at: true, available_from: true, available_until: true, max_attempts: true
      }
    });

    res.status(200).json({ data: tests });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch test series' });
  }
};

// 3. ACTION: Start a Test Attempt (With Fault Tolerance & Constraints)
export const startTestAttempt = async (req: Request, res: Response) => {
  try {
    const { testSeriesId } = req.params;
    const userId = (req as any).user.id;
    const now = new Date();

    // Fetch test details to validate timing and limits
    const testSeries = await prisma.testSeries.findUnique({
      where: { id: testSeriesId as string }
    });

    if (!testSeries || !testSeries.is_active || !testSeries.is_published) {
      return res.status(404).json({ error: 'Test is currently unavailable' });
    }

    // Enforce "Available From" and "Available Until" strictly
    if (testSeries.available_from > now) {
      return res.status(403).json({ error: 'This test has not started yet.' });
    }
    if (testSeries.available_until && testSeries.available_until < now) {
      return res.status(403).json({ error: 'This test has expired.' });
    }

    // Check attempt limits using an atomic count
    const previousAttemptsCount = await prisma.testAttempt.count({
      where: { user_id: userId, test_series_id: testSeriesId as string }
    });

    if (previousAttemptsCount >= testSeries.max_attempts) {
      return res.status(403).json({ error: `You have reached the maximum allowed attempts (${testSeries.max_attempts}) for this test.` });
    }

    // FAULT TOLERANCE Check: Is there an existing "in_progress" attempt? (App crashed and reopened)
    let activeAttempt = await prisma.testAttempt.findFirst({
      where: { user_id: userId, test_series_id: testSeriesId as string, status: 'in_progress' }
    });

    if (!activeAttempt) {
      // Create a brand new attempt
      activeAttempt = await prisma.testAttempt.create({
        data: {
          user_id: userId,
          test_series_id: testSeriesId as string,
          attempt_number: previousAttemptsCount + 1,
          status: 'in_progress',
          device_fingerprint: req.headers['user-agent'] || 'unknown',
          ip_address: req.ip || 'unknown'
        }
      });
    }

    res.status(200).json({ 
      message: 'Test started successfully', 
      attemptId: activeAttempt.id,
      testDetails: {
        duration_minutes: testSeries.duration_minutes,
        negative_marking: testSeries.negative_marking,
        instructions: testSeries.instructions,
        available_until: testSeries.available_until
      }
    });
  } catch (error) {
    console.error('Start Test Error:', error);
    res.status(500).json({ error: 'Failed to start test attempt' });
  }
};

// 4. SECURITY: Fetch Questions safely (Stripping correct answers)
export const getSecureTestQuestions = async (req: Request, res: Response) => {
  try {
    const { testSeriesId, attemptId } = req.params;
    const userId = (req as any).user.id;

    // Security Check: Ensure the user actually has an active attempt for this test!
    const validAttempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId as string }
    });

    if (!validAttempt || validAttempt.user_id !== userId || validAttempt.test_series_id !== testSeriesId) {
      return res.status(403).json({ error: 'Invalid or unauthorized test attempt' });
    }

    if (validAttempt.status !== 'in_progress') {
      return res.status(403).json({ error: 'This test attempt has already been submitted' });
    }

    // CRITICAL SECURITY: Use Prisma `select` to ONLY return safe data to the mobile device
    const questions = await prisma.question.findMany({
      where: { test_series_id: testSeriesId as string, is_active: true },
      orderBy: { display_order: 'asc' },
      select: {
        id: true,
        subject: true,
        section: true,
        question_type: true,
        question_text: true,
        question_text_hindi: true,
        marks: true,
        // Notice we DO NOT select `correct_option_id`, `explanation`, or `explanation_hindi`!
        options: true // Note: Assuming options JSON structure does NOT contain an `is_correct` boolean if sent to client. 
        // If your options JSON *does* contain `is_correct`, we must map over it to strip it out.
      }
    });

    // Sub-step: If your 'options' JSON field has the 'is_correct' flag from the admin upload, we must strip it in memory!
    const securedQuestions = questions.map(q => {
      const safeOptions = (q.options as any[]).map(opt => ({
        id: opt.id,
        text: opt.text
      }));
      return { ...q, options: safeOptions };
    });

    res.status(200).json({ data: securedQuestions });
  } catch (error) {
    console.error('Fetch Secure Questions Error:', error);
    res.status(500).json({ error: 'Failed to fetch test questions' });
  }
};

// 5. OFFLINE RESILIENCE: Sync test progress in the background
export const syncTestProgress = async (req: Request, res: Response) => {
  try {
    const { testSeriesId, attemptId } = req.params;
    const userId = (req as any).user.id;
    
    // answers should be an array like: [{ question_id: "123", selected_option_id: "b", status: "answered" }]
    const { answers } = req.body; 

    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'Invalid answers payload format' });
    }

    // 1. Verify the attempt belongs to the user and is still active
    const validAttempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId as string }
    });

    if (!validAttempt || validAttempt.user_id !== userId || validAttempt.test_series_id !== testSeriesId) {
      return res.status(403).json({ error: 'Invalid or unauthorized test attempt' });
    }

    if (validAttempt.status !== 'in_progress') {
      return res.status(403).json({ error: 'Cannot sync progress. This test is already submitted or closed.' });
    }

    // 2. Update the answers JSON in the database with the latest state from the mobile device
    // By keeping the mobile device as the "source of truth" during the test, 
    // it perfectly handles cases where the internet disconnected and reconnected.
    await prisma.testAttempt.update({
      where: { id: attemptId as string },
      data: {
        answers: answers
      }
    });

    res.status(200).json({ message: 'Progress synced successfully', syncedAt: new Date() });
  } catch (error) {
    console.error('Sync Progress Error:', error);
    res.status(500).json({ error: 'Failed to sync test progress' });
  }
};

// 6. SCORING ENGINE: Submit the test, calculate scores, and award XP
export const submitTestAttempt = async (req: Request, res: Response) => {
  try {
    const { testSeriesId, attemptId } = req.params;
    const userId = (req as any).user.id;
    const { answers } = req.body; // Final answers array from the mobile app

    // 1. Verify Attempt & Status
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId as string }
    });

    if (!attempt || attempt.user_id !== userId || attempt.test_series_id !== testSeriesId) {
      return res.status(403).json({ error: 'Invalid or unauthorized test attempt' });
    }

    if (attempt.status === 'completed') {
      return res.status(400).json({ error: 'This test has already been submitted and scored.' });
    }

    // 2. Fetch the Test Rules (Negative marking, etc.)
    const testSeries = await prisma.testSeries.findUnique({
      where: { id: testSeriesId as string }
    });

    if (!testSeries) return res.status(404).json({ error: 'Test Series not found' });

    // 3. Fetch the REAL questions (This time, we DO need the correct_option_id!)
    const questions = await prisma.question.findMany({
      where: { test_series_id: testSeriesId as string, is_active: true }
    });

    // 4. Initialize Grading Counters
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    let totalScore = 0;

    // Create a map of the student's answers for O(1) lookups
    // Assuming answers array format: [{ question_id: "uuid", selected_option_id: "a" }, ...]
    const studentAnswersMap = new Map();
    if (Array.isArray(answers)) {
      answers.forEach(ans => {
        if (ans.question_id && ans.selected_option_id) {
          studentAnswersMap.set(ans.question_id, ans.selected_option_id);
        }
      });
    }

    // 5. The Grading Loop
    questions.forEach(question => {
      const studentAnswer = studentAnswersMap.get(question.id);

      if (!studentAnswer) {
        unattemptedCount++;
      } else if (studentAnswer === question.correct_option_id) {
        correctCount++;
        totalScore += question.marks;
      } else {
        incorrectCount++;
        if (testSeries.negative_marking) {
          totalScore -= Number(testSeries.negative_marks_per_wrong);
        }
      }
    });

    // Safeguard against negative total scores if you prefer scores to floor at 0
    // totalScore = Math.max(0, totalScore);

    const maxPossibleScore = testSeries.total_marks;
    const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    
    // Calculate time taken (in seconds)
    const timeTakenSeconds = Math.floor((new Date().getTime() - attempt.started_at.getTime()) / 1000);

    // 6. Gamification: Calculate XP Earned
    // Base XP just for finishing: 10
    // Bonus XP based on accuracy
    const xpEarned = 10 + Math.floor(correctCount * 2);

    // 7. Atomic Transaction: Update the Attempt AND the User's Total XP simultaneously
    const [updatedAttempt, updatedUser] = await prisma.$transaction([
      prisma.testAttempt.update({
        where: { id: attemptId as string },
        data: {
          status: 'completed',
          submitted_at: new Date(),
          time_taken_seconds: timeTakenSeconds,
          score: totalScore,
          max_score: maxPossibleScore,
          percentage: percentage,
          correct_count: correctCount,
          incorrect_count: incorrectCount,
          unattempted_count: unattemptedCount,
          answers: answers || [],
          xp_earned: xpEarned
        }
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          xp_total: { increment: xpEarned } // Prisma's atomic increment!
        }
      })
    ]);

    res.status(200).json({
      message: 'Test submitted successfully',
      result: {
        score: totalScore,
        max_score: maxPossibleScore,
        percentage: percentage.toFixed(2),
        correct: correctCount,
        incorrect: incorrectCount,
        unattempted: unattemptedCount,
        time_taken_seconds: timeTakenSeconds,
        xp_earned: xpEarned
      }
    });

  } catch (error) {
    console.error('Submit Test Error:', error);
    res.status(500).json({ error: 'Failed to grade and submit test' });
  }
};