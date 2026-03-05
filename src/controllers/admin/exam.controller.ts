// src/controllers/admin/exam.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';
import { S } from '@upstash/redis/zmscore-DcU8fVDf';

// Create a new Exam category (e.g., SSC CGL)
export const createExam = async (req: Request, res: Response) => {
  try {
    const { name, slug, category, conducting_body, description, display_order } = req.body;

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
        exam_pattern: req.body.exam_pattern || {}
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
    const exams = await prisma.exam.findMany({
      orderBy: { display_order: 'asc' }
    });
    res.status(200).json({ data: exams });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
};

// Update an Exam
export const updateExam = async (req: Request, res: Response) => {
  try {
    const { id  } = req.params;
    const updatedExam = await prisma.exam.update({
      where: { id: id as string  },
      data: req.body
    });
    res.status(200).json({ message: 'Exam updated successfully', exam: updatedExam });
  } catch (error) {
    console.error('Update Exam Error:', error);
    res.status(500).json({ error: 'Failed to update exam' });
  }
};