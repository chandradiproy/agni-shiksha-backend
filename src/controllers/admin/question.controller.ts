// src/controllers/admin/question.controller.ts

import { Request, Response } from 'express';
import { Readable } from 'stream';
import csv from 'csv-parser';
import { z } from 'zod';
import prisma from '../../config/db';
import { sanitizeContent } from '../../utils/sanitizer';

// Zod Schema (works for both CSV strings and Frontend JSON numbers)
const questionRowSchema = z.object({
  exam_slug: z.string().min(1, 'Exam slug is required'),
  subject: z.string().min(1, 'Subject is required'),
  topic: z.string().min(1, 'Topic is required'),
  sub_topic: z.string().optional(),
  section: z.string().min(1, 'Section is required'),
  question_type: z.enum(['mcq', 'true_false', 'fill_blank']).default('mcq'),
  question_text: z.string().min(5, 'Must be at least 5 characters'),
  question_text_hindi: z.string().optional(),
  option_a: z.string().min(1, 'Option A is required'),
  option_b: z.string().min(1, 'Option B is required'),
  option_c: z.string().optional(),
  option_d: z.string().optional(),
  correct_option: z.enum(['a', 'b', 'c', 'd'], {
    message: 'Must be exactly a, b, c, or d'
  }),
  explanation: z.string().min(1, 'Explanation is required'),
  explanation_hindi: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard'], {
    message: 'Must be easy, medium, or hard'
  }),
  cognitive_type: z.string().default('conceptual'),
  marks: z.preprocess((val) => Number(val) || 1, z.number()),
  tags: z.string().optional(),
  source: z.string().default('original'),
  pyq_year: z.preprocess((val) => val ? Number(val) : null, z.number().nullable().optional())
});

// ==========================================
// STEP 1: PREVIEW (Reads CSV, Validates, Returns to UI)
// ==========================================
export const previewBulkQuestions = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded.' });
    }

    const rawRows: any[] = await new Promise((resolve, reject) => {
      const rows: any[] = [];
      Readable.from(req.file!.buffer)
        .pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });

    if (rawRows.length === 0) {
      return res.status(400).json({ error: 'The CSV file is empty.' });
    }

    // Pre-fetch Exams for validation
    const exams = await prisma.exam.findMany({ select: { slug: true } });
    const validSlugs = new Set(exams.map(e => e.slug));

    const previewData = rawRows.map((row, index) => {
      let isValid = true;
      const fieldErrors: Record<string, string> = {};

      // 1. Validate with Zod
      const validation = questionRowSchema.safeParse(row);
      if (!validation.success) {
        isValid = false;
        // Map Zod errors to specific fields so the UI knows exactly which table cell to highlight red
        validation.error.issues.forEach((issue: z.ZodIssue) => {
          const fieldName = issue.path[0] as string;
          fieldErrors[fieldName] = issue.message;
        });
      }

      // 2. Validate Exam Slug exists
      if (row.exam_slug && !validSlugs.has(row.exam_slug)) {
        isValid = false;
        fieldErrors['exam_slug'] = `Exam '${row.exam_slug}' not found`;
      }

      return {
        id: `row-${index}`, // Unique ID for React map() keys
        data: row,
        isValid,
        errors: fieldErrors
      };
    });

    res.status(200).json({
      message: 'Preview generated',
      totalRows: previewData.length,
      invalidRows: previewData.filter(r => !r.isValid).length,
      preview: previewData
    });

  } catch (error) {
    console.error('Preview Error:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
};


// ==========================================
// STEP 2: COMMIT (Accepts JSON from UI, Sanitizes, Inserts)
// ==========================================
export const commitBulkQuestions = async (req: Request, res: Response) => {
  try {
    const { questions } = req.body; // Expecting an array of question objects from frontend

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'No questions provided for upload.' });
    }

    const exams = await prisma.exam.findMany({ select: { id: true, slug: true } });
    const examMap = new Map(exams.map(e => [e.slug, e.id]));

    const validQuestions: any[] = [];
    const finalErrors: any[] = [];
    const adminId = (req as any).admin.id;

    questions.forEach((rawRow, index) => {
      const validation = questionRowSchema.safeParse(rawRow);
      
      if (!validation.success) {
        finalErrors.push({ row: index + 1, error: 'Validation failed after edit' });
        return;
      }

      const row = validation.data;
      const exam_id = examMap.get(row.exam_slug);

      if (!exam_id) {
        finalErrors.push({ row: index + 1, error: 'Invalid exam slug' });
        return;
      }

      // Assemble and sanitize
      const options = [
        { id: 'a', text: sanitizeContent(row.option_a), is_correct: row.correct_option === 'a' },
        { id: 'b', text: sanitizeContent(row.option_b), is_correct: row.correct_option === 'b' },
      ];
      if (row.option_c) options.push({ id: 'c', text: sanitizeContent(row.option_c), is_correct: row.correct_option === 'c' });
      if (row.option_d) options.push({ id: 'd', text: sanitizeContent(row.option_d), is_correct: row.correct_option === 'd' });

      const tagsArray = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

      validQuestions.push({
        exam_id,
        subject: row.subject,
        topic: row.topic,
        sub_topic: row.sub_topic || null,
        section: row.section,
        question_type: row.question_type,
        question_text: sanitizeContent(row.question_text),
        question_text_hindi: sanitizeContent(row.question_text_hindi),
        options,
        correct_option_id: row.correct_option,
        explanation: sanitizeContent(row.explanation),
        explanation_hindi: sanitizeContent(row.explanation_hindi),
        difficulty: row.difficulty,
        question_type_cognitive: row.cognitive_type,
        marks: row.marks,
        tags: tagsArray,
        source: row.source,
        pyq_year: row.pyq_year,
        display_order: index + 1,
        created_by: adminId
      });
    });

    if (validQuestions.length > 0) {
      await prisma.question.createMany({ data: validQuestions });
    }

    res.status(200).json({
      message: 'Questions successfully uploaded',
      successCount: validQuestions.length,
      errorCount: finalErrors.length,
      errors: finalErrors.length > 0 ? finalErrors : undefined
    });

  } catch (error) {
    console.error('Commit Upload Error:', error);
    res.status(500).json({ error: 'Failed to commit questions to database' });
  }
};