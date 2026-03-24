"use strict";
// src/routes/student/gamification.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const gamification_controller_1 = require("../../controllers/student/gamification.controller");
const router = (0, express_1.Router)();
// Protect routes
router.use(auth_1.requireAuth);
// GET /api/v1/student/gamification/leaderboard
// Returns the top 100 users by XP (Cached in Redis)
router.get('/leaderboard', gamification_controller_1.getLeaderboard);
// GET /api/v1/student/gamification/profile
// Returns user's streak, gems, level, and unlocked badges
router.get('/profile', gamification_controller_1.getGamificationProfile);
exports.default = router;
