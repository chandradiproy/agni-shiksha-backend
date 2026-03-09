// src/routes/admin/gamification.routes.ts

import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import { 
  createQuest, 
  getQuests, 
  createBadge, 
  getBadges 
} from '../../controllers/admin/gamification.controller';

const router = Router();

// ==========================================
// QUESTS
// ==========================================
router.post('/quests', requireAdmin, createQuest);
router.get('/quests', requireAdmin, getQuests);

// ==========================================
// BADGES
// ==========================================
router.post('/badges', requireAdmin, createBadge);
router.get('/badges', requireAdmin, getBadges);

export default router;