// src/routes/admin/question.routes.ts

import { Router } from 'express';
import multer from 'multer';
import { requireAdmin } from '../../middlewares/adminAuth';
import { 
  previewBulkQuestions, 
  commitBulkQuestions,
  getTestSeriesQuestions,
  updateQuestion,
  deleteQuestion
} from '../../controllers/admin/question.controller';

const router = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } 
});

// ==========================================
// BULK UPLOAD FLOW
// ==========================================
router.post('/test-series/:testSeriesId/preview-bulk', requireAdmin, upload.single('file'), previewBulkQuestions);
router.post('/test-series/:testSeriesId/commit-bulk', requireAdmin, commitBulkQuestions);

// ==========================================
// INDIVIDUAL QUESTION MANAGEMENT
// ==========================================
// Fetch all questions to populate the Admin UI table
router.get('/test-series/:testSeriesId', requireAdmin, getTestSeriesQuestions);

// Update a specific question (using the same strict validation and sanitization as bulk)
router.put('/test-series/:testSeriesId/question/:questionId', requireAdmin, updateQuestion);

// Delete a specific question
router.delete('/test-series/:testSeriesId/question/:questionId', requireAdmin, deleteQuestion);

export default router;