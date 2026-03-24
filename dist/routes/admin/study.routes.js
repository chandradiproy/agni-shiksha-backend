"use strict";
// src/routes/admin/study.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const study_controller_1 = require("../../controllers/admin/study.controller");
const adminAuth_1 = require("../../middlewares/adminAuth");
const router = (0, express_1.Router)();
router.use(adminAuth_1.requireAdmin);
// ------------------------------------------------------------------
// Study Materials Routes
// ------------------------------------------------------------------
router.post('/materials', study_controller_1.createStudyMaterial);
router.get('/materials', study_controller_1.getStudyMaterials);
router.put('/materials/:id', study_controller_1.updateStudyMaterial);
router.delete('/materials/:id', study_controller_1.deleteStudyMaterial);
// ------------------------------------------------------------------
// Study Plans Routes
// ------------------------------------------------------------------
router.post('/plans', study_controller_1.createStudyPlan);
router.get('/plans', study_controller_1.getStudyPlans);
router.put('/plans/:id', study_controller_1.updateStudyPlan);
router.delete('/plans/:id', study_controller_1.deleteStudyPlan);
// ------------------------------------------------------------------
// Study Plan Tasks Routes
// ------------------------------------------------------------------
router.post('/plans/:planId/tasks', study_controller_1.addStudyPlanTask);
router.put('/tasks/:taskId', study_controller_1.updateStudyPlanTask);
router.delete('/tasks/:taskId', study_controller_1.deleteStudyPlanTask);
exports.default = router;
