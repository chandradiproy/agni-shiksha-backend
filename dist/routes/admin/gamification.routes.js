"use strict";
// src/routes/admin/gamification.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_1 = require("../../middlewares/adminAuth");
const gamification_controller_1 = require("../../controllers/admin/gamification.controller");
const router = (0, express_1.Router)();
// ==========================================
// QUESTS
// ==========================================
router.post('/quests', adminAuth_1.requireAdmin, gamification_controller_1.createQuest);
router.get('/quests', adminAuth_1.requireAdmin, gamification_controller_1.getQuests);
router.put('/quests/:id', adminAuth_1.requireAdmin, gamification_controller_1.updateQuest);
router.delete('/quests/:id', adminAuth_1.requireAdmin, gamification_controller_1.deleteQuest);
// ==========================================
// BADGES
// ==========================================
router.post('/badges', adminAuth_1.requireAdmin, gamification_controller_1.createBadge);
router.get('/badges', adminAuth_1.requireAdmin, gamification_controller_1.getBadges);
router.put('/badges/:id', adminAuth_1.requireAdmin, gamification_controller_1.updateBadge);
router.delete('/badges/:id', adminAuth_1.requireAdmin, gamification_controller_1.deleteBadge);
exports.default = router;
