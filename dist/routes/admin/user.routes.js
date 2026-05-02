"use strict";
// src/routes/admin/user.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_1 = require("../../middlewares/adminAuth");
const user_controller_1 = require("../../controllers/admin/user.controller");
const router = (0, express_1.Router)();
// Get list of all students
router.get('/', adminAuth_1.requireAdmin, user_controller_1.getAllStudents);
// Ban or unban a student (app-wide)
router.put('/:id/ban', adminAuth_1.requireAdmin, user_controller_1.toggleBanStudent);
// Block or unblock a student from the community forum
router.put('/:userId/forum-ban', adminAuth_1.requireAdmin, user_controller_1.toggleForumBan);
// Revoke all remote sessions for security
router.put('/:id/revoke-sessions', adminAuth_1.requireAdmin, user_controller_1.revokeAllUserSessions);
// Permanently delete user
router.delete('/:id', adminAuth_1.requireAdmin, user_controller_1.hardDeleteUser);
exports.default = router;
