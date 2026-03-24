"use strict";
// src/routes/admin/moderation.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_1 = require("../../middlewares/adminAuth");
const moderation_controller_1 = require("../../controllers/admin/moderation.controller");
const router = (0, express_1.Router)();
// Fetch doubts for moderation (supports ?filter=all|flagged|resolved and ?search=keyword)
router.get('/doubts', adminAuth_1.requireAdmin, moderation_controller_1.getModerationDoubts);
// Update a doubt's status (e.g., mark as resolved or un-flag it)
router.put('/doubts/:id/status', adminAuth_1.requireAdmin, moderation_controller_1.updateDoubtStatus);
// Delete an inappropriate doubt
router.delete('/doubts/:id', adminAuth_1.requireAdmin, moderation_controller_1.deleteDoubt);
// Delete an inappropriate answer
router.delete('/answers/:id', adminAuth_1.requireAdmin, moderation_controller_1.deleteDoubtAnswer);
exports.default = router;
