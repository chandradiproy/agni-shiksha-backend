"use strict";
// src/routes/student/study.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const study_controller_1 = require("../../controllers/student/study.controller");
const router = (0, express_1.Router)();
// Protect routes
router.use(auth_1.requireAuth);
// GET /api/v1/student/study/plans
// Fetch day-by-day study plans (Tasks are included)
router.get('/plans', study_controller_1.getStudyPlans);
// GET /api/v1/student/study/materials
// Fetch PDFs and Video links (Includes dynamic premium paywall locking)
router.get('/materials', study_controller_1.getStudyMaterials);
exports.default = router;
