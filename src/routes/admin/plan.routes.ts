// src/routes/admin/plan.routes.ts

import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import { 
  createPlan, 
  getAllPlans, 
  updatePlan, 
  deletePlan 
} from '../../controllers/admin/plan.controller';

const router = Router();

// Protect all plan management routes
router.use(requireAdmin);

// ------------------------------------------------------------------
// Premium Subscription Plans Management
// ------------------------------------------------------------------
router.post('/', createPlan);
router.get('/', getAllPlans);
router.put('/:id', updatePlan);
router.delete('/:id', deletePlan);

export default router;