// src/routes/student/category.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { getAllCategories } from '../../controllers/student/category.controller';

const router = Router();

// Protect all category routes
router.use(requireAuth);

// 1. List all active exam categories (for filter chips in ExamListScreen)
router.get('/', getAllCategories);

export default router;
