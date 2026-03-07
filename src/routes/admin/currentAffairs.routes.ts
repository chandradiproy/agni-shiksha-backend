// src/routes/admin/currentAffairs.routes.ts

import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import { triggerNewsSync, getAdminArticles, updateArticleStatus } from '../../controllers/admin/currentAffairs.controller';

const router = Router();

// Manually trigger an immediate fetch from the GNews API
router.post('/sync', requireAdmin, triggerNewsSync);

// Fetch the cached articles from PostgreSQL
router.get('/', requireAdmin, getAdminArticles);

// Hide or Pin an article
router.put('/:id/status', requireAdmin, updateArticleStatus);

export default router;