// src/routes/student/home.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { getHomeDashboard } from '../../controllers/student/home.controller';

const router = Router();

// Secure home route
router.use(requireAuth);

// GET /api/v1/student/home
// Returns the fully aggregated dashboard (Streak, Quizzes, Recommendations, News)
router.get('/', getHomeDashboard);

export default router;