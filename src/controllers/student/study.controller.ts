// src/controllers/student/study.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import { CacheService } from '../../services/cache.service';

// ==========================================
// 1. GET STUDY PLANS (Day-by-Day Syllabus)
// ==========================================
export const getStudyPlans = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    
    // Fallback to the user's default exam if they don't explicitly filter
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { target_exam_id: true } });
    const examId = (req.query.examId as string) || user?.target_exam_id;

    if (!examId) {
      return res.status(400).json({ error: 'Please select a target exam to view study plans.' });
    }

    // Cache the study plan structure per exam (Cached for 1 hour)
    const cacheScope = `study_plans:exam:${examId}`;
    let plans;
    const cachedPlans = await CacheService.get<any[]>('study', cacheScope);

    if (cachedPlans) {
      plans = cachedPlans;
    } else {
      plans = await prisma.studyPlan.findMany({
        where: { exam_id: examId },
        include: {
          tasks: {
            orderBy: { day_number: 'asc' }
          }
        },
        orderBy: { created_at: 'desc' }
      });
      await CacheService.set('study', cacheScope, plans, 3600);
    }

    res.status(200).json({
      success: true,
      data: plans
    });

  } catch (error) {
    console.error('Get Study Plans Error:', error);
    res.status(500).json({ error: 'Failed to fetch study plans' });
  }
};

// ==========================================
// 2. GET STUDY MATERIALS (PDFs/Videos with Soft-Gate)
// ==========================================
export const getStudyMaterials = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const subject = req.query.subject as string;
    
    // 1. Fetch user to check their premium status and default exam
    const user = await prisma.user.findUnique({ 
      where: { id: userId }, 
      select: { target_exam_id: true, is_premium: true } 
    });

    const examId = (req.query.examId as string) || user?.target_exam_id;

    if (!examId) {
      return res.status(400).json({ error: 'Please select a target exam.' });
    }

    // 2. Fetch Base Materials from Redis Cache (Shared globally across all students for this exam)
    // We cache the raw database records for 1 hour
    const cacheScope = `study_materials:exam:${examId}:subject:${subject || 'all'}`;
    let materials;
    const cachedMaterials = await CacheService.get<any[]>('study', cacheScope);

    if (cachedMaterials) {
      materials = cachedMaterials;
    } else {
      const whereClause: any = { exam_id: examId, is_active: true };
      if (subject) whereClause.subject = subject;

      materials = await prisma.studyMaterial.findMany({
        where: whereClause,
        orderBy: [{ is_premium: 'desc' }, { created_at: 'desc' }]
      });
      await CacheService.set('study', cacheScope, materials, 3600);
    }

    // 3. SECURITY GATE: Apply Premium Paywall Logic IN-MEMORY
    // We strip the file_url for free users accessing premium content
    const secureMaterials = materials.map((material: any) => {
      const isLocked = material.is_premium && !user?.is_premium;
      
      return {
        ...material,
        file_url: isLocked ? null : material.file_url, // Obscure the URL if locked!
        is_locked: isLocked // Frontend uses this boolean to show the "Crown" icon and trigger Razorpay
      };
    });

    res.status(200).json({
      success: true,
      data: secureMaterials
    });

  } catch (error) {
    console.error('Get Study Materials Error:', error);
    res.status(500).json({ error: 'Failed to fetch study materials' });
  }
};
