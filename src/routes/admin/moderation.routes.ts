// src/routes/admin/moderation.routes.ts

import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import { 
  getModerationDoubts, 
  updateDoubtStatus,
  deleteDoubt, 
  deleteDoubtAnswer 
} from '../../controllers/admin/moderation.controller';

const router = Router();

// Fetch doubts for moderation (supports ?filter=all|flagged|resolved and ?search=keyword)
router.get('/doubts', requireAdmin, getModerationDoubts);

// Update a doubt's status (e.g., mark as resolved or un-flag it)
router.put('/doubts/:id/status', requireAdmin, updateDoubtStatus);

// Delete an inappropriate doubt
router.delete('/doubts/:id', requireAdmin, deleteDoubt);

// Delete an inappropriate answer
router.delete('/answers/:id', requireAdmin, deleteDoubtAnswer);

export default router;