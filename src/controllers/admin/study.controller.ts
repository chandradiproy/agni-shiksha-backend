// src/controllers/admin/study.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import { CacheService } from '../../services/cache.service';
import { QueueService } from '../../services/queue.service';
import { broadcastCacheInvalidation } from '../../utils/broadcast';

const CACHE_TAG = 'study';

// ==========================================
// STUDY MATERIALS (PDFs / Video Links)
// ==========================================

export const createStudyMaterial = async (req: Request, res: Response) => {
  try {
    const { exam_id, title, subject, topic, material_type, file_url, is_active, is_premium } = req.body;
    const adminId = (req as any).admin?.id as string;

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
        is_premium: is_premium ?? false, // Controls the Soft Gate
        created_by: adminId 
      }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'CREATED_STUDY_MATERIAL',
        target_id: material.id,
        details: { title }
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);
    broadcastCacheInvalidation(CACHE_TAG);

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
    console.error('Fetch Study Materials Error:', error);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
};

export const updateStudyMaterial = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const adminId = (req as any).admin?.id as string;

    const existingMaterial = await prisma.studyMaterial.findUnique({ where: { id: id as string } });
    if (!existingMaterial) return res.status(404).json({ error: 'Study Material not found' });

    const updatedMaterial = await prisma.studyMaterial.update({
      where: { id: id as string },
      data: {
        ...updateData,
        updated_by: adminId
      }
    });

    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'UPDATED_STUDY_MATERIAL',
        target_id: id as string,
        details: { fields_updated: Object.keys(updateData) }
      }
    });
    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);
    broadcastCacheInvalidation(CACHE_TAG);

    res.status(200).json({ message: 'Study material updated successfully', data: updatedMaterial });
  } catch (error) {
    console.error('Update Study Material Error:', error);
    res.status(500).json({ error: 'Failed to update study material' });
  }
};

export const deleteStudyMaterial = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin?.id as string;

    const existingMaterial = await prisma.studyMaterial.findUnique({ where: { id: id as string } });
    if (!existingMaterial) return res.status(404).json({ error: 'Study Material not found' });

    await prisma.studyMaterial.delete({
      where: { id: id as string }
    });

    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'DELETED_STUDY_MATERIAL',
        target_id: id as string,
        details: { title: existingMaterial.title }
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);
    broadcastCacheInvalidation(CACHE_TAG);

    res.status(200).json({ message: 'Study material deleted successfully' });
  } catch (error) {
    console.error('Delete Study Material Error:', error);
    res.status(500).json({ error: 'Failed to delete study material' });
  }
};

// ==========================================
// STUDY PLANS (Day-by-Day Syllabus)
// ==========================================

export const createStudyPlan = async (req: Request, res: Response) => {
  try {
    const { exam_id, title, duration_days } = req.body;
    const adminId = (req as any).admin?.id as string;

    if (!exam_id || !title || !duration_days) {
      return res.status(400).json({ error: 'Exam ID, title, and duration are required' });
    }

    const plan = await prisma.studyPlan.create({
      data: { 
        exam_id, 
        title, 
        duration_days: Number(duration_days),
        created_by: adminId 
      }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'CREATED_STUDY_PLAN',
        target_id: plan.id,
        details: { title }
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);
    broadcastCacheInvalidation(CACHE_TAG);

    res.status(201).json({ message: 'Study plan created successfully', data: plan });
  } catch (error) {
    console.error('Create Study Plan Error:', error);
    res.status(500).json({ error: 'Failed to create study plan' });
  }
};

export const getStudyPlans = async (req: Request, res: Response) => {
  try {
    const plans = await prisma.studyPlan.findMany({
      orderBy: { created_at: 'desc' },
      include: { 
        exam: { select: { name: true } },
        _count: { select: { tasks: true } },
        tasks: { include: { material: true }}
      }
    });

    res.status(200).json({ data: plans });
  } catch (error) {
    console.error('Fetch Study Plans Error:', error);
    res.status(500).json({ error: 'Failed to fetch study plans' });
  }
};

export const updateStudyPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const adminId = (req as any).admin?.id as string;

    const existingPlan = await prisma.studyPlan.findUnique({ where: { id: id as string } });
    if (!existingPlan) return res.status(404).json({ error: 'Study Plan not found' });

    if (updateData.duration_days) {
      updateData.duration_days = Number(updateData.duration_days);
    }

    const updatedPlan = await prisma.studyPlan.update({
      where: { id: id as string },
      data: {
        ...updateData,
        updated_by: adminId
      }
    });

    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'UPDATED_STUDY_PLAN',
        target_id: id as string
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);
    broadcastCacheInvalidation(CACHE_TAG);

    res.status(200).json({ message: 'Study plan updated successfully', data: updatedPlan });
  } catch (error) {
    console.error('Update Study Plan Error:', error);
    res.status(500).json({ error: 'Failed to update study plan' });
  }
};

export const deleteStudyPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin?.id as string;

    const existingPlan = await prisma.studyPlan.findUnique({ where: { id: id as string } });
    if (!existingPlan) return res.status(404).json({ error: 'Study Plan not found' });

    await prisma.studyPlan.delete({
      where: { id: id as string }
    });

    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'DELETED_STUDY_PLAN',
        target_id: id as string,
        details: { title: existingPlan.title }
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);
    broadcastCacheInvalidation(CACHE_TAG);

    res.status(200).json({ message: 'Study plan deleted successfully' });
  } catch (error) {
    console.error('Delete Study Plan Error:', error);
    res.status(500).json({ error: 'Failed to delete study plan' });
  }
};

export const addStudyPlanTask = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { day_number, task_title, task_description, reference_material_id } = req.body;
    const adminId = (req as any).admin?.id as string;

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

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'ADDED_STUDY_PLAN_TASK',
        target_id: task.id,
        details: { task_title, plan_id: planId }
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);
    broadcastCacheInvalidation(CACHE_TAG);

    res.status(201).json({ message: 'Task added to plan successfully', data: task });
  } catch (error) {
    console.error('Add Study Plan Task Error:', error);
    res.status(500).json({ error: 'Failed to add task to study plan' });
  }
};

export const updateStudyPlanTask = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const updateData = req.body;
    const adminId = (req as any).admin?.id as string;

    const existingTask = await prisma.studyPlanTask.findUnique({ where: { id: taskId as string } });
    if (!existingTask) return res.status(404).json({ error: 'Study plan task not found' });

    if (updateData.day_number) {
      updateData.day_number = Number(updateData.day_number);
      // Validate against parent plan's duration limits
      const plan = await prisma.studyPlan.findUnique({ where: { id: existingTask.study_plan_id } });
      if (plan && (updateData.day_number > plan.duration_days || updateData.day_number < 1)) {
        return res.status(400).json({ error: `Day number must be between 1 and ${plan.duration_days}` });
      }
    }

    const updatedTask = await prisma.studyPlanTask.update({
      where: { id: taskId as string },
      data: updateData
    });

    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'UPDATED_STUDY_PLAN_TASK',
        target_id: taskId as string,
        details: { plan_id: existingTask.study_plan_id }
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);
    broadcastCacheInvalidation(CACHE_TAG);

    res.status(200).json({ message: 'Task updated successfully', data: updatedTask });
  } catch (error) {
    console.error('Update Study Plan Task Error:', error);
    res.status(500).json({ error: 'Failed to update study plan task' });
  }
};

export const deleteStudyPlanTask = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const adminId = (req as any).admin?.id as string;

    const existingTask = await prisma.studyPlanTask.findUnique({ where: { id: taskId as string } });
    if (!existingTask) return res.status(404).json({ error: 'Study plan task not found' });

    await prisma.studyPlanTask.delete({
      where: { id: taskId as string }
    });

    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'DELETED_STUDY_PLAN_TASK',
        target_id: taskId as string,
        details: { plan_id: existingTask.study_plan_id }
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);
    broadcastCacheInvalidation(CACHE_TAG);

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete Study Plan Task Error:', error);
    res.status(500).json({ error: 'Failed to delete study plan task' });
  }
};