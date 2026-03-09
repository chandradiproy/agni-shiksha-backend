// src/controllers/admin/study.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';

// ==========================================
// STUDY MATERIALS (PDFs / Video Links)
// ==========================================

export const createStudyMaterial = async (req: Request, res: Response) => {
  try {
    const { exam_id, title, subject, topic, material_type, file_url, is_active, is_premium } = req.body;

    if (!exam_id || !title || !subject || !topic || !material_type || !file_url) {
      return res.status(400).json({ error: 'All core material fields are required' });
    }

    const material = await prisma.studyMaterial.create({
      data: {
        exam_id,
        title,
        subject,
        topic,
        material_type,
        file_url,
        is_active: is_active ?? true,
        is_premium: is_premium ?? false // Controls the Soft Gate
      }
    });

    res.status(201).json({ message: 'Study material added successfully', data: material });
  } catch (error) {
    console.error('Create Study Material Error:', error);
    res.status(500).json({ error: 'Failed to create study material' });
  }
};

export const getStudyMaterials = async (req: Request, res: Response) => {
  try {
    const { examId } = req.query;
    const whereClause = examId ? { exam_id: examId as string } : {};

    const materials = await prisma.studyMaterial.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      include: { exam: { select: { name: true } } }
    });

    res.status(200).json({ data: materials });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
};

// ==========================================
// STUDY PLANS (Day-by-Day Syllabus)
// ==========================================

export const createStudyPlan = async (req: Request, res: Response) => {
  try {
    const { exam_id, title, duration_days } = req.body;

    if (!exam_id || !title || !duration_days) {
      return res.status(400).json({ error: 'Exam ID, title, and duration are required' });
    }

    const plan = await prisma.studyPlan.create({
      data: { exam_id, title, duration_days: Number(duration_days) }
    });

    res.status(201).json({ message: 'Study plan created successfully', data: plan });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create study plan' });
  }
};

export const getStudyPlans = async (req: Request, res: Response) => {
  try {
    const plans = await prisma.studyPlan.findMany({
      orderBy: { created_at: 'desc' },
      include: { 
        exam: { select: { name: true } },
        _count: { select: { tasks: true } }
      }
    });

    res.status(200).json({ data: plans });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch study plans' });
  }
};

export const addStudyPlanTask = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { day_number, task_title, task_description, reference_material_id } = req.body;

    if (!day_number || !task_title) {
      return res.status(400).json({ error: 'Day number and task title are required' });
    }

    const plan = await prisma.studyPlan.findUnique({ where: { id: planId as string } });
    if (!plan) return res.status(404).json({ error: 'Study plan not found' });

    if (day_number > plan.duration_days || day_number < 1) {
      return res.status(400).json({ error: `Day number must be between 1 and ${plan.duration_days}` });
    }

    const task = await prisma.studyPlanTask.create({
      data: {
        study_plan_id: planId as string,
        day_number: Number(day_number),
        task_title,
        task_description,
        reference_material_id
      }
    });

    res.status(201).json({ message: 'Task added to plan successfully', data: task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add task to study plan' });
  }
};