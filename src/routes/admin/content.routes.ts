// src/routes/admin/content.routes.ts

import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import { createExam, getAllExams, updateExam } from '../../controllers/admin/exam.controller';
import { createTestSeries, getTestSeriesByExam } from '../../controllers/admin/testSeries.controller';

const router = Router();

// ==========================================
// EXAM ROUTES (Protected by requireAdmin)
// ==========================================
router.post('/exams', requireAdmin, createExam);
router.get('/exams', requireAdmin, getAllExams);
router.put('/exams/:id', requireAdmin, updateExam);

// ==========================================
// TEST SERIES ROUTES (Protected by requireAdmin)
// ==========================================
router.post('/test-series', requireAdmin, createTestSeries);
router.get('/test-series/exam/:examId', requireAdmin, getTestSeriesByExam);

export default router;