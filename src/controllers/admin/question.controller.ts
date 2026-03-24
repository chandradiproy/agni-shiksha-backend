// src/controllers/admin/question.controller.ts

import { Request, Response } from 'express';
import { Readable } from 'stream';
import csv from 'csv-parser';
import { z } from 'zod';
import prisma from '../../config/db';
import { sanitizeContent } from '../../utils/sanitizer';
import { CacheService } from '../../services/cache.service';
import { QueueService } from '../../services/queue.service';

const CACHE_TAG = 'tests';

// Zod Schema (works for both CSV strings and Frontend JSON numbers)
const questionRowSchema = z.object({
  // REMOVED exam_slug: We now get the exact context directly from the API URL!
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
    message: 'Must be a, b, c, or d',
    
  }),
  explanation: z.string().min(1, 'Explanation is required'),
  explanation_hindi: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard'], { 
    message: 'Must be easy, medium, or hard'
  }),
  cognitive_type: z.string().default('conceptual'),
  marks: z.preprocess((val) => Number(val) || 1, z.number()),
  
  // PREPROCESS FIX: If frontend sends an array, join it into a string so it matches the CSV format!
  tags: z.preprocess((val) => Array.isArray(val) ? val.join(',') : val, z.string().optional()),
  
  source: z.string().default('original'),
  pyq_year: z.preprocess((val) => val ? Number(val) : null, z.number().nullable().optional())
});

// ==========================================
// STEP 1: PREVIEW (Reads CSV, Validates, Returns to UI)
// ==========================================
export const previewBulkQuestions = async (req: Request, res: Response) => {
  try {
    const { testSeriesId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded.' });
    }

    // Validate that the Test Series actually exists before parsing the file
    const testSeries = await prisma.testSeries.findUnique({ 
      where: { id: testSeriesId as string } 
    });

    if (!testSeries) {
      return res.status(404).json({ error: 'Test Series not found. Cannot preview questions.' });
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

    const previewData = rawRows.map((row, index) => {
      let isValid = true;
      const fieldErrors: Record<string, string> = {};

      // 1. Validate with Zod (No need to check validSlugs manually anymore!)
      const validation = questionRowSchema.safeParse(row);
      if (!validation.success) {
        isValid = false;
        validation.error.issues.forEach((issue: z.ZodIssue) => {
          const fieldName = issue.path[0] as string;
          fieldErrors[fieldName] = issue.message;
        });
      }

      return {
        id: `row-${index}`, 
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
    const { testSeriesId } = req.params;
    const { questions } = req.body; 

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'No questions provided for upload.' });
    }

    // Fetch Test Series to automatically link BOTH exam_id and test_series_id
    const testSeries = await prisma.testSeries.findUnique({ 
      where: { id: testSeriesId as string } 
    });

    if (!testSeries) {
      return res.status(404).json({ error: 'Test Series not found.' });
    }

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

      // Assemble and sanitize
      const options = [
        { id: 'a', text: sanitizeContent(row.option_a), is_correct: row.correct_option === 'a' },
        { id: 'b', text: sanitizeContent(row.option_b), is_correct: row.correct_option === 'b' },
      ];
      if (row.option_c) options.push({ id: 'c', text: sanitizeContent(row.option_c), is_correct: row.correct_option === 'c' });
      if (row.option_d) options.push({ id: 'd', text: sanitizeContent(row.option_d), is_correct: row.correct_option === 'd' });

      const tagsArray = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

      validQuestions.push({
        exam_id: testSeries.exam_id,         // <--- AUTO-ASSIGNED!
        test_series_id: testSeries.id,       // <--- AUTO-ASSIGNED!
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
      
      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          admin_id: adminId,
          action: 'BULK_CREATED_QUESTIONS',
          target_id: testSeriesId as string,
          details: { count: validQuestions.length }
        }
      });
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

// ==========================================
// STEP 3: MANAGE INDIVIDUAL QUESTIONS
// ==========================================

// Get all questions for a specific Test Series (Used for the UI Preview Table)
export const getTestSeriesQuestions = async (req: Request, res: Response) => {
  try {
    const { testSeriesId } = req.params;
    
    const questions = await prisma.question.findMany({
      where: { test_series_id: testSeriesId as string },
      orderBy: { display_order: 'asc' }
    });

    res.status(200).json({ data: questions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
};

// Update a single question
export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const { testSeriesId, questionId } = req.params;
    const adminId = (req as any).admin?.id as string;

    // 1. Security Check: Is the Test Series locked?
    const testSeries = await prisma.testSeries.findUnique({ where: { id: testSeriesId as string } });
    if (!testSeries) return res.status(404).json({ error: 'Test Series not found' });
    
    if ((testSeries as any).is_published === true) {
      return res.status(403).json({ error: 'Test Series is live. Cannot edit questions to preserve score integrity.' });
    }

    // 2. Validate the incoming JSON using the same Zod schema from the bulk upload!
    const validation = questionRowSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`) 
      });
    }

    const row = validation.data;

    // 3. Sanitize options & content
    const options = [
      { id: 'a', text: sanitizeContent(row.option_a), is_correct: row.correct_option === 'a' },
      { id: 'b', text: sanitizeContent(row.option_b), is_correct: row.correct_option === 'b' },
    ];
    if (row.option_c) options.push({ id: 'c', text: sanitizeContent(row.option_c), is_correct: row.correct_option === 'c' });
    if (row.option_d) options.push({ id: 'd', text: sanitizeContent(row.option_d), is_correct: row.correct_option === 'd' });

    const tagsArray = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    // 4. Update Database
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId as string },
      data: {
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
      }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'UPDATED_QUESTION',
        target_id: updatedQuestion.id
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);

    res.status(200).json({ message: 'Question updated successfully', question: updatedQuestion });
  } catch (error) {
    console.error('Update Question Error:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
};

// Delete a single question
export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const { testSeriesId, questionId } = req.params;
    const adminId = (req as any).admin?.id as string;

    // 1. Security Check: Is the Test Series locked?
    const testSeries = await prisma.testSeries.findUnique({ where: { id: testSeriesId as string } });
    if (!testSeries) return res.status(404).json({ error: 'Test Series not found' });
    
    if ((testSeries as any).is_published === true) {
      return res.status(403).json({ error: 'Test Series is live. Cannot delete questions.' });
    }

    // 2. Delete the Question
    await prisma.question.delete({
      where: { id: questionId as string }
    });

    // Audit Log
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'DELETED_QUESTION',
        target_id: questionId as string
      }
    });

    await CacheService.invalidateTag(CACHE_TAG);
    await QueueService.enqueueSilentSync(CACHE_TAG);

    res.status(200).json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete Question Error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
};