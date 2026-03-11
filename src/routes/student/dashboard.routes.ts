// src/routes/student/dashboard.routes.ts

import { Router } from 'express';
import { getHomeDashboard, getAiInsights } from '../../controllers/student/dashboard.controller';
import { requireAuth } from '../../middlewares/auth'; // Adjust import based on your exact auth middleware name

const router = Router();

// Protect all dashboard routes to ensure only logged-in students can access them
router.use(requireAuth);

// GET /api/v1/student/dashboard/home
// Returns aggregated User Stats, Recommended Tests, News, and Quests
router.get('/home', getHomeDashboard);

// GET /api/v1/student/dashboard/ai-insights
// Returns AI calculated strengths, weaknesses, and predicted scores
router.get('/ai-insights', getAiInsights);

export default router;