// src/routes/student/currentAffairs.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { getStudentArticles, getStudentArticleById } from '../../controllers/student/currentAffairs.controller';

const router = Router();

// Fetch the feed of visible articles (Summaries only for speed)
// Endpoint: GET /api/v1/student/articles
router.get('/', requireAuth, getStudentArticles);

// Fetch full article body content (Called when opening ArticleDetailScreen)
// Endpoint: GET /api/v1/student/articles/:id
router.get('/:id', requireAuth, getStudentArticleById);

export default router;