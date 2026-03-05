// src/routes/admin/content.routes.ts

import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import { createExam, getAllExams, updateExam } from '../../controllers/admin/exam.controller';
import { 
  createTestSeries, 
  getTestSeriesByExam, 
  updateTestSeries, 
  deleteTestSeries 
} from '../../controllers/admin/testSeries.controller';

const router = Router();

// ==========================================
// EXAM ROUTES
// ==========================================
router.post('/exams', requireAdmin, createExam);
router.get('/exams', requireAdmin, getAllExams);
router.put('/exams/:id', requireAdmin, updateExam);

// ==========================================
// TEST SERIES ROUTES
// ==========================================
router.post('/test-series', requireAdmin, createTestSeries);
router.get('/test-series/exam/:examId', requireAdmin, getTestSeriesByExam);
router.put('/test-series/:id', requireAdmin, updateTestSeries); // NEW
router.delete('/test-series/:id', requireAdmin, deleteTestSeries); // NEW

export default router;