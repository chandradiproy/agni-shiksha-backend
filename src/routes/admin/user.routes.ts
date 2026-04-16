// src/routes/admin/user.routes.ts

import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import { getAllStudents, toggleBanStudent, toggleForumBan, revokeAllUserSessions } from '../../controllers/admin/user.controller';

const router = Router();

// Get list of all students
router.get('/', requireAdmin, getAllStudents);

// Ban or unban a student (app-wide)
router.put('/:id/ban', requireAdmin, toggleBanStudent);

// Block or unblock a student from the community forum
router.put('/:userId/forum-ban', requireAdmin, toggleForumBan);

// Revoke all remote sessions for security
router.put('/:id/revoke-sessions', requireAdmin, revokeAllUserSessions);

export default router;