// src/controllers/student/study.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';

export const getStudentStudyMaterials = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { examId, subject } = req.query;

    if (!examId) return res.status(400).json({ error: 'examId is required' });

    // 1. Fetch user to check premium status
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isUserPremium = user?.is_premium || false;

    // Build filter
    const whereClause: any = { exam_id: examId as string, is_active: true };
    if (subject) whereClause.subject = subject as string;

    // 2. Fetch all active materials
    const materials = await prisma.studyMaterial.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' }
    });

    // 3. THE SOFT GATE: Strip the 'file_url' if the content is premium AND the user is free
    const safeMaterials = materials.map(mat => {
      if (mat.is_premium && !isUserPremium) {
        return {
          ...mat,
          file_url: null, // SECURITY: Nullify the actual payload!
          is_locked: true, // Helper flag for React Native/Kotlin UI
          lock_reason: 'Requires Premium Subscription'
        };
      }
      return { ...mat, is_locked: false }; // Full access
    });

    res.status(200).json({ data: safeMaterials });
  } catch (error) {
    console.error('Fetch Materials Error:', error);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
};

export const getStudentStudyPlans = async (req: Request, res: Response) => {
  try {
    const { examId } = req.query;
    if (!examId) return res.status(400).json({ error: 'examId is required' });

    // Fetch plans with nested tasks, but DO NOT fetch the raw material file_url here
    const plans = await prisma.studyPlan.findMany({
      where: { exam_id: examId as string },
      include: {
        tasks: {
          orderBy: { day_number: 'asc' },
          include: { 
            // Only send basic metadata about the linked material to the UI
            material: { select: { id: true, title: true, material_type: true, is_premium: true } } 
          }
        }
      }
    });

    res.status(200).json({ data: plans });
  } catch (error) {
    console.error('Fetch Study Plans Error:', error);
    res.status(500).json({ error: 'Failed to fetch study plans' });
  }
};