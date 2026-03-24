"use strict";
// src/routes/student/home.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const home_controller_1 = require("../../controllers/student/home.controller");
const router = (0, express_1.Router)();
// Secure home route
router.use(auth_1.requireAuth);
// GET /api/v1/student/home
// Returns the fully aggregated dashboard (Streak, Quizzes, Recommendations, News)
router.get('/', home_controller_1.getHomeDashboard);
exports.default = router;
