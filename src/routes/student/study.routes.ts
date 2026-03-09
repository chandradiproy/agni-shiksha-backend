// src/routes/student/study.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { getStudentStudyMaterials, getStudentStudyPlans } from '../../controllers/student/study.controller';

const router = Router();

// Fetch Study Materials (PDFs/Videos) with Soft Gate security
// Example: GET /api/v1/student/study/materials?examId=123&subject=Maths
router.get('/materials', requireAuth, getStudentStudyMaterials);

// Fetch Day-by-Day syllabus tracking
// Example: GET /api/v1/student/study/plans?examId=123
router.get('/plans', requireAuth, getStudentStudyPlans);

export default router;