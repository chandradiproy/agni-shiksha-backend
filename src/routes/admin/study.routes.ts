// src/routes/admin/study.routes.ts

import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import { 
  createStudyMaterial, 
  getStudyMaterials,
  createStudyPlan,
  getStudyPlans,
  addStudyPlanTask
} from '../../controllers/admin/study.controller';

const router = Router();

router.post('/materials', requireAdmin, createStudyMaterial);
router.get('/materials', requireAdmin, getStudyMaterials);

router.post('/plans', requireAdmin, createStudyPlan);
router.get('/plans', requireAdmin, getStudyPlans);
router.post('/plans/:planId/tasks', requireAdmin, addStudyPlanTask);

export default router;