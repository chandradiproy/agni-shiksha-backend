"use strict";
// src/routes/student/analysis.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const analysis_controller_1 = require("../../controllers/student/analysis.controller");
const router = (0, express_1.Router)();
// Protect routes
router.use(auth_1.requireAuth);
// GET /api/v1/student/analysis/:attemptId
// Returns the breakdown of score, rank, and subject strengths
router.get('/:attemptId', analysis_controller_1.getTestAnalysis);
// GET /api/v1/student/analysis/:attemptId/review
// Returns the questions with ONLY the correct options and explanations
router.get('/:attemptId/review', analysis_controller_1.getTestReview);
exports.default = router;
