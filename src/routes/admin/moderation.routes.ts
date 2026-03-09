// src/routes/admin/moderation.routes.ts

import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import { 
  getModerationDoubts, 
  deleteDoubt, 
  deleteDoubtAnswer 
} from '../../controllers/admin/moderation.controller';

const router = Router();

// Fetch doubts for moderation (supports ?filter=flagged query)
router.get('/doubts', requireAdmin, getModerationDoubts);

// Delete an inappropriate doubt
router.delete('/doubts/:id', requireAdmin, deleteDoubt);

// Delete an inappropriate answer
router.delete('/answers/:id', requireAdmin, deleteDoubtAnswer);

export default router;