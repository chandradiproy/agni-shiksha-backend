// src/controllers/admin/testSeries.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import { CacheService } from '../../services/cache.service';
import { QueueService } from '../../services/queue.service';
import { broadcastCacheInvalidation } from '../../utils/broadcast';
import { getTestSeriesMutationBlock } from '../../services/assessment-lock.service';

const CACHE_TAG = 'tests';

// Create a new Test Series under an Exam
export const createTestSeries = async (req: Request, res: Response) => {
  try {
    const { 
      exam_id, title, description, type, test_type, subject,
      total_questions, duration_minutes, total_marks, difficulty,
      negative_marking, negative_marks_per_wrong, is_all_india,
      is_active, is_scheduled, is_published, scheduled_at,
      available_from, available_until, max_attempts, show_solutions,
      show_solutions_after, instructions, sections, price_if_standalone
    } = req.body;
    
    const adminId = (req as any).admin?.id as string;

    // Strict validation for core required fields based on Schema
    if (!exam_id || !title || !type || !test_type || total_questions === undefined || duration_minutes === undefined || total_marks === undefined || !difficulty) {
      return res.status(400).json({ error: 'Missing required test series core fields' });
    }

    const parsedAvailableFrom = available_from ? new Date(available_from) : new Date();
    const parsedAvailableUntil = available_until ? new Date(available_until) : null;

    // LOGICAL DATE VALIDATION: Ensure 'Until' is strictly after 'From'
    if (parsedAvailableUntil && parsedAvailableFrom >= parsedAvailableUntil) {
      return res.status(400).json({ error: '"Available Until" date must be strictly after the "Available From" date.' });
    }

    const newTestSeries = await prisma.testSeries.create({
      data: {
        exam_id,
        title,
        description,
        type, 
        test_type, 
        subject,
        total_questions: Number(total_questions),
        duration_minutes: Number(duration_minutes),
        total_marks: Number(total_marks),
        negative_marking: negative_marking || false,
        negative_marks_per_wrong: negative_marks_per_wrong ? Number(negative_marks_per_wrong) : 0.00,
        difficulty,
        is_all_india: is_all_india || false,
        is_active: is_active ?? true,
        is_scheduled: is_scheduled || false,
        is_published: is_published || false,
        // Parse Dates if provided
        scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
        available_from: parsedAvailableFrom,
        available_until: parsedAvailableUntil,
        max_attempts: max_attempts ? Number(max_attempts) : 3,
        show_solutions: show_solutions ?? true,
        show_solutions_after: show_solutions_after || 'immediate',
        instructions,
        sections: sections || [], // Handled as JSON
        price_if_standalone: price_if_standalone ? Number(price_if_standalone) : null,
        created_by: adminId // <-- NEW
      }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'CREATED_TEST_SERIES',
        target_id: newTestSeries.id,
        details: { title }
      }
    });
    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);

    res.status(201).json({ message: 'Test Series created successfully', testSeries: newTestSeries });
  } catch (error) {
    console.error('Create Test Series Error:', error);
    res.status(500).json({ error: 'Failed to create test series' });
  }
};

// Get Test Series by Exam ID
export const getTestSeriesByExam = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const testSeries = await prisma.testSeries.findMany({
      where: { exam_id: examId as string },
      orderBy: { created_at: 'desc' }
    });
    res.status(200).json({ data: testSeries });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch test series' });
  }
};

// Update a Test Series
export const updateTestSeries = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin?.id as string;
    const updateData = { ...req.body, updated_by: adminId }; // <-- NEW

    const mutationBlock = await getTestSeriesMutationBlock(id as string, 'update this test series');
    if (mutationBlock) {
      return res.status(mutationBlock.status).json({ error: mutationBlock.error });
    }

    // 1. Fetch existing test to check publication status
    const existingTest = await prisma.testSeries.findUnique({ where: { id: id as string } });
    if (!existingTest) {
      return res.status(404).json({ error: 'Test Series not found' });
    }

    // 2. VALIDATION LOCK: If it is already published, we block structural changes.
    // Skip this lock if the user is explicitly unpublishing the test in this request.
    if (existingTest.is_published === true && updateData.is_published !== false) {
      const forbiddenLiveEdits = ['total_questions', 'total_marks', 'duration_minutes', 'negative_marks_per_wrong'];
      
      // Only flag fields that ACTUALLY changed value
      const attemptedForbiddenEdits = forbiddenLiveEdits.filter(field => {
        if (updateData[field] === undefined) return false;
        if (field === 'negative_marks_per_wrong') return Number(updateData[field]) !== Number(existingTest[field as keyof typeof existingTest]);
        return updateData[field] !== existingTest[field as keyof typeof existingTest];
      });
      
      if (attemptedForbiddenEdits.length > 0) {
        return res.status(403).json({ 
          error: `Cannot modify structural fields (${attemptedForbiddenEdits.join(', ')}) while the test is published. Please unpublish first.` 
        });
      }
    }

    // Format Dates if they are being updated
    if (updateData.scheduled_at) updateData.scheduled_at = new Date(updateData.scheduled_at);
    if (updateData.available_from) updateData.available_from = new Date(updateData.available_from);
    if (updateData.available_until) updateData.available_until = new Date(updateData.available_until);

    // 3. LOGICAL DATE VALIDATION
    // We must check the incoming dates, or fallback to existing DB dates if only one is being updated.
    const finalAvailableFrom = updateData.available_from !== undefined ? updateData.available_from : existingTest.available_from;
    const finalAvailableUntil = updateData.available_until !== undefined ? updateData.available_until : existingTest.available_until;

    if (finalAvailableUntil && finalAvailableFrom && finalAvailableFrom >= finalAvailableUntil) {
      return res.status(400).json({ error: '"Available Until" date must be strictly after the "Available From" date.' });
    }

    const updatedTestSeries = await prisma.testSeries.update({
      where: { id: id as string },
      data: updateData
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'UPDATED_TEST_SERIES',
        target_id: updatedTestSeries.id
      }
    });
    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);
    broadcastCacheInvalidation(CACHE_TAG);

    res.status(200).json({ message: 'Test Series updated successfully', testSeries: updatedTestSeries });
  } catch (error) {
    console.error('Update Test Series Error:', error);
    res.status(500).json({ error: 'Failed to update test series' });
  }
};

// Delete a Test Series
export const deleteTestSeries = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin?.id as string;

    const mutationBlock = await getTestSeriesMutationBlock(id as string, 'delete this test series');
    if (mutationBlock) {
      return res.status(mutationBlock.status).json({ error: mutationBlock.error });
    }

    await prisma.testSeries.delete({
      where: { id: id as string }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'DELETED_TEST_SERIES',
        target_id: id as string
      }
    });
    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);
    broadcastCacheInvalidation(CACHE_TAG);
    
    res.status(200).json({ message: 'Test Series deleted successfully' });
  } catch (error) {
    console.error('Delete Test Series Error:', error);
    res.status(500).json({ error: 'Failed to delete test series' });
  }
};
