// src/routes/admin/user.routes.ts

import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import { getAllStudents, toggleBanStudent } from '../../controllers/admin/user.controller';

const router = Router();

// Get list of all students
router.get('/', requireAdmin, getAllStudents);

// Ban or unban a student
router.put('/:id/ban', requireAdmin, toggleBanStudent);

export default router;