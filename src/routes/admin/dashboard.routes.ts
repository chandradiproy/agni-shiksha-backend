// src/routes/admin/dashboard.routes.ts

import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import { getDashboardStats } from '../../controllers/admin/dashboard.controller';

const router = Router();

router.get('/stats', requireAdmin, getDashboardStats);

export default router;