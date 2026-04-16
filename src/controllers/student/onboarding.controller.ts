import { Request, Response } from 'express';
import prisma from '../../config/db';
import { CacheService } from '../../services/cache.service';
import { onboardingSetupSchema } from '../../schemas/onboarding.schema';

// ==========================================
// 1. GET EXAMS (Global list of exams)
// ==========================================
export const getExams = async (req: Request, res: Response) => {
  try {
    const cacheScope = 'exams:all_active';
    let exams;
    const cachedExams = await CacheService.get<any[]>('onboarding', cacheScope);

    if (cachedExams) {
      exams = cachedExams;
    } else {
      exams = await prisma.exam.findMany({
        where: { is_active: true },
        select: {
          id: true,
          name: true,
          category: true,
          thumbnail_url: true,
          description: true,
          display_order: true
        },
        orderBy: { display_order: 'asc' }
      });
      await CacheService.set('onboarding', cacheScope, exams, 3600);
    }

    res.status(200).json({ success: true, data: exams });
  } catch (error) {
    console.error('Get Exams Error:', error);
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
};

// ==========================================
// 2. GET EXAM SUBJECTS
// ==========================================
export const getExamSubjects = async (req: Request, res: Response) => {
  try {
    const examId = req.params.examId as string;
    
    if (!examId) {
      return res.status(400).json({ error: 'Exam ID is required.' });
    }

    const cacheScope = `exam_subjects:${examId}`;
    let subjectsData;
    const cachedSubjects = await CacheService.get<any>('onboarding', cacheScope);

    if (cachedSubjects) {
      subjectsData = cachedSubjects;
    } else {
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: { subjects: true }
      });

      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }
      
      subjectsData = exam.subjects;
      await CacheService.set('onboarding', cacheScope, subjectsData, 3600);
    }

    res.status(200).json({ success: true, data: subjectsData });
  } catch (error) {
    console.error('Get Exam Subjects Error:', error);
    res.status(500).json({ error: 'Failed to fetch subjects for the exam' });
  }
};

// ==========================================
// 3. POST SETUP ONBOARDING
// ==========================================
export const setupOnboarding = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    
    // Validate request payload
    const parsedData = onboardingSetupSchema.parse(req.body);

    // Ensure the target exam exists
    const examExists = await prisma.exam.findUnique({
      where: { id: parsedData.target_exam_id }
    });

    if (!examExists) {
      return res.status(400).json({ error: 'Invalid target exam selected.' });
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        target_exam_id: parsedData.target_exam_id,
        study_language: parsedData.study_language,
        prep_level: parsedData.prep_level,
        daily_study_hours: parsedData.daily_study_hours || 2
      },
      select: {
        id: true,
        target_exam_id: true,
        study_language: true,
        prep_level: true,
        onboarding_completed: true
      }
    });

    res.status(200).json({
      success: true,
      message: 'Onboarding setup recorded successfully.',
      data: updatedUser
    });
  } catch (error: any) {
    console.error('Setup Onboarding Error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation Error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to record onboarding details' });
  }
};

// ==========================================
// 4. POST COMPLETE ONBOARDING
// ==========================================
export const completeOnboarding = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { onboarding_completed: true },
      select: { id: true, onboarding_completed: true }
    });
    
    res.status(200).json({
      success: true,
      message: 'Onboarding marked as completed.',
      data: updatedUser
    });
  } catch (error) {
    console.error('Complete Onboarding Error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
};

// ==========================================
// 5. GET TUTORIAL DATA
// ==========================================
export const getTutorialData = async (req: Request, res: Response) => {
  try {
    // Stub response for the UI walk-through
    const tutorialSteps = [
      { id: 1, title: 'Welcome', description: 'Browse and take exams quickly.' },
      { id: 2, title: 'Gamification', description: 'Earn XP, get onto leaderboards.' },
      { id: 3, title: 'AI Insights', description: 'Get actionable feedback on your tests.' }
    ];

    res.status(200).json({
      success: true,
      data: tutorialSteps
    });
  } catch (error) {
    console.error('Get Tutorial Data Error:', error);
    res.status(500).json({ error: 'Failed to fetch tutorial data' });
  }
};
