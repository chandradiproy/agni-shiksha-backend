// src/controllers/admin/exam.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';

// Create a new Exam category (e.g., SSC CGL)
export const createExam = async (req: Request, res: Response) => {
  try {
    const { name, slug, category, conducting_body, description, display_order } = req.body;
    const adminId = (req as any).admin.id as string;

    if (!name || !slug || !category || !conducting_body) {
      return res.status(400).json({ error: 'Name, slug, category, and conducting_body are required' });
    }

    const newExam = await prisma.exam.create({
      data: {
        name,
        slug,
        category,
        conducting_body,
        description,
        display_order: display_order || 1,
        subjects: req.body.subjects || [],
        exam_pattern: req.body.exam_pattern || {},
        created_by: adminId
      }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'CREATED_EXAM',
        target_id: newExam.id,
        details: { name, slug }
      }
    });

    res.status(201).json({ message: 'Exam created successfully', exam: newExam });
  } catch (error: any) {
    console.error('Create Exam Error:', error);
    if (error.code === 'P2002') return res.status(400).json({ error: 'Exam slug must be unique' });
    res.status(500).json({ error: 'Failed to create exam' });
  }
};

// Get all Exams
export const getAllExams = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = (req.query.search as string) || '';
    const skip = (page - 1) * limit;

    // Build the search query
    const whereClause = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { slug: { contains: search, mode: 'insensitive' as const } },
        { category: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {};

    const [exams, totalCount] = await Promise.all([
      prisma.exam.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { display_order: 'asc' }
      }),
      prisma.exam.count({ where: whereClause })
    ]);

    res.status(200).json({
      data: exams,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Fetch Exams Error:', error);
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
};

// Update an Exam
export const updateExam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin.id as string;

    const updatedExam = await prisma.exam.update({
      where: { id: id as string },
      data: {...req.body, updated_by: adminId }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'UPDATED_EXAM',
        target_id: updatedExam.id
      }
    });

    res.status(200).json({ message: 'Exam updated successfully', exam: updatedExam });
  } catch (error) {
    console.error('Update Exam Error:', error);
    res.status(500).json({ error: 'Failed to update exam' });
  }
};

// Delete an Exam
export const deleteExam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).admin?.id as string;

    if (!id) {
      return res.status(400).json({ error: 'Exam ID is required' });
    }

    // 1. Fetch existing exam and count related test series
    const existingExam = await prisma.exam.findUnique({ 
      where: { id: id as string },
      include: {
        _count: {
          select: { test_series: true, study_materials: true, study_plans: true }
        }
      }
    });

    if (!existingExam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // 2. VALIDATION LOCK: Do not allow deletion if there are dependent records
    if (existingExam._count.test_series > 0 || existingExam._count.study_materials > 0 || existingExam._count.study_plans > 0) {
      return res.status(403).json({ 
        error: `Cannot delete exam because it still has associated Test Series (${existingExam._count.test_series}), Study Materials (${existingExam._count.study_materials}), or Study Plans (${existingExam._count.study_plans}). Please delete them first.` 
      });
    }

    // 3. Perform deletion
    await prisma.exam.delete({
      where: { id: id as string }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'DELETED_EXAM',
        target_id: id as string,
        details: { exam_name: existingExam.name }
      }
    });

    res.status(200).json({ message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('Delete Exam Error:', error);
    res.status(500).json({ error: 'Failed to delete exam' });
  }
};