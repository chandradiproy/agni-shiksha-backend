// src/routes/student/analysis.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { getTestAnalysis, getTestReview } from '../../controllers/student/analysis.controller';

const router = Router();

// Protect routes
router.use(requireAuth);

// GET /api/v1/student/analysis/:attemptId
// Returns the breakdown of score, rank, and subject strengths
router.get('/:attemptId', getTestAnalysis);

// GET /api/v1/student/analysis/:attemptId/review
// Returns the questions with ONLY the correct options and explanations
router.get('/:attemptId/review', getTestReview);

export default router;