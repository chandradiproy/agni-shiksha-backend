// src/routes/admin/gamification.routes.ts

import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import { 
  createQuest, 
  getQuests,
  updateQuest,
  deleteQuest,
  createBadge, 
  getBadges,
  updateBadge,
  deleteBadge
} from '../../controllers/admin/gamification.controller';

const router = Router();

// ==========================================
// QUESTS
// ==========================================
router.post('/quests', requireAdmin, createQuest);
router.get('/quests', requireAdmin, getQuests);
router.put('/quests/:id', requireAdmin, updateQuest);
router.delete('/quests/:id', requireAdmin, deleteQuest);

// ==========================================
// BADGES
// ==========================================
router.post('/badges', requireAdmin, createBadge);
router.get('/badges', requireAdmin, getBadges);
router.put('/badges/:id', requireAdmin, updateBadge);
router.delete('/badges/:id', requireAdmin, deleteBadge);

export default router;  