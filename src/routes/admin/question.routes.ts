// src/routes/admin/question.routes.ts

import { Router } from 'express';
import multer from 'multer';
import { requireAdmin } from '../../middlewares/adminAuth';
import { previewBulkQuestions, commitBulkQuestions } from '../../controllers/admin/question.controller';

const router = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } 
});

// ==========================================
// QUESTION UPLOAD FLOW (Protected by requireAdmin)
// ==========================================

// STEP 1: Upload CSV file, get parsed & validated preview back (Does not save to DB)
router.post('/preview-bulk', requireAdmin, upload.single('file'), previewBulkQuestions);

// STEP 2: Submit the corrected JSON array from the frontend table to save to DB
router.post('/commit-bulk', requireAdmin, commitBulkQuestions);

export default router;  