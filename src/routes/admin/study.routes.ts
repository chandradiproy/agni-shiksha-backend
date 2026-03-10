// src/routes/admin/study.routes.ts

import { Router } from 'express';
import { 
  createStudyMaterial, 
  getStudyMaterials, 
  updateStudyMaterial,
  deleteStudyMaterial,
  createStudyPlan, 
  getStudyPlans, 
  updateStudyPlan,
  deleteStudyPlan,
  addStudyPlanTask,
  updateStudyPlanTask,
  deleteStudyPlanTask
} from '../../controllers/admin/study.controller';
import { requireAdmin } from '../../middlewares/adminAuth';

const router = Router();

router.use(requireAdmin);

// ------------------------------------------------------------------
// Study Materials Routes
// ------------------------------------------------------------------
router.post('/materials', createStudyMaterial);
router.get('/materials', getStudyMaterials);
router.put('/materials/:id', updateStudyMaterial);
router.delete('/materials/:id', deleteStudyMaterial);

// ------------------------------------------------------------------
// Study Plans Routes
// ------------------------------------------------------------------
router.post('/plans', createStudyPlan);
router.get('/plans', getStudyPlans);
router.put('/plans/:id', updateStudyPlan);
router.delete('/plans/:id', deleteStudyPlan);

// ------------------------------------------------------------------
// Study Plan Tasks Routes
// ------------------------------------------------------------------
router.post('/plans/:planId/tasks', addStudyPlanTask);
router.put('/tasks/:taskId', updateStudyPlanTask);
router.delete('/tasks/:taskId', deleteStudyPlanTask);

export default router;