// src/routes/student/study.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { getStudyPlans, getStudyMaterials } from '../../controllers/student/study.controller';

const router = Router();

// Protect routes
router.use(requireAuth);

// GET /api/v1/student/study/plans
// Fetch day-by-day study plans (Tasks are included)
router.get('/plans', getStudyPlans);

// GET /api/v1/student/study/materials
// Fetch PDFs and Video links (Includes dynamic premium paywall locking)
router.get('/materials', getStudyMaterials);

export default router;