// src/routes/student/currentAffairs.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { getArticles, getArticleDetails } from '../../controllers/student/currentAffairs.controller';

const router = Router();

// Protect routes (or leave public if you want guest access to news)
router.use(requireAuth);

// GET /api/v1/student/articles
// Fetches the lightweight paginated news feed
router.get('/', getArticles);

// GET /api/v1/student/articles/:id
// Fetches the full HTML/Markdown body of a specific article
router.get('/:id', getArticleDetails);

export default router;