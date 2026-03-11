// src/routes/student/gamification.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { getLeaderboard, getGamificationProfile } from '../../controllers/student/gamification.controller';

const router = Router();

// Protect routes
router.use(requireAuth);

// GET /api/v1/student/gamification/leaderboard
// Returns the top 100 users by XP (Cached in Redis)
router.get('/leaderboard', getLeaderboard);

// GET /api/v1/student/gamification/profile
// Returns user's streak, gems, level, and unlocked badges
router.get('/profile', getGamificationProfile);

export default router;