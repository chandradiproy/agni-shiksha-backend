"use strict";
// src/routes/student/dashboard.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("../../controllers/student/dashboard.controller");
const auth_1 = require("../../middlewares/auth"); // Adjust import based on your exact auth middleware name
const router = (0, express_1.Router)();
// Protect all dashboard routes to ensure only logged-in students can access them
router.use(auth_1.requireAuth);
// GET /api/v1/student/dashboard/home
// Returns aggregated User Stats, Recommended Tests, News, and Quests
router.get('/home', dashboard_controller_1.getHomeDashboard);
// GET /api/v1/student/dashboard/ai-insights
// Returns AI calculated strengths, weaknesses, and predicted scores
router.get('/ai-insights', dashboard_controller_1.getAiInsights);
exports.default = router;
