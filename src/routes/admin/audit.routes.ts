// src/routes/admin/audit.routes.ts

import { Router } from 'express';
import { getAuditLogs } from '../../controllers/admin/audit.controller';
import { requireAdmin, requireRole } from '../../middlewares/adminAuth';

const router = Router();

// Secure all routes with the admin authentication middleware
router.use(requireAdmin);

// Secure all routes with the admin authentication middleware
router.use(requireRole(['admin','super-admin','super_admin']));

// Get paginated audit logs
router.get('/', getAuditLogs);

export default router;