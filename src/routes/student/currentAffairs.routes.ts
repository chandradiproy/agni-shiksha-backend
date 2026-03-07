// src/routes/student/currentAffairs.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { getStudentArticles } from '../../controllers/student/currentAffairs.controller';

const router = Router();

// Fetch the feed of visible articles
// Endpoint: GET /api/v1/student/articles
router.get('/', requireAuth, getStudentArticles);

export default router;