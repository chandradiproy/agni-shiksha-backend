// src/controllers/admin/testSeries.controller.ts

import { Request, Response } from 'express';
import prisma from '../../config/db';

// Create a new Test Series under an Exam
export const createTestSeries = async (req: Request, res: Response) => {
  try {
    const { 
      exam_id, title, description, type, test_type, 
      total_questions, duration_minutes, total_marks, difficulty 
    } = req.body;

    // Basic validation
    if (!exam_id || !title || !type || !test_type || !total_questions || !duration_minutes || !total_marks || !difficulty) {
      return res.status(400).json({ error: 'Missing required test series fields' });
    }

    const newTestSeries = await prisma.testSeries.create({
      data: {
        exam_id,
        title,
        description,
        type, // free, premium
        test_type, // full_mock, sectional, etc.
        total_questions,
        duration_minutes,
        total_marks,
        difficulty,
        subject: req.body.subject,
        negative_marking: req.body.negative_marking || false,
        negative_marks_per_wrong: req.body.negative_marks_per_wrong || 0.00,
        is_all_india: req.body.is_all_india || false,
        sections: req.body.sections || []
      }
    });

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