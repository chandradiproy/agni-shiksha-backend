"use strict";
// src/routes/admin/content.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_1 = require("../../middlewares/adminAuth");
const exam_controller_1 = require("../../controllers/admin/exam.controller");
const testSeries_controller_1 = require("../../controllers/admin/testSeries.controller");
const router = (0, express_1.Router)();
// ==========================================
// EXAM ROUTES
// ==========================================
router.post('/exams', adminAuth_1.requireAdmin, exam_controller_1.createExam);
router.get('/exams', adminAuth_1.requireAdmin, exam_controller_1.getAllExams);
router.put('/exams/:id', adminAuth_1.requireAdmin, exam_controller_1.updateExam);
router.delete('/exams/:id', adminAuth_1.requireAdmin, exam_controller_1.deleteExam);
// ==========================================
// TEST SERIES ROUTES
// ==========================================
router.post('/test-series', adminAuth_1.requireAdmin, testSeries_controller_1.createTestSeries);
router.get('/test-series/exam/:examId', adminAuth_1.requireAdmin, testSeries_controller_1.getTestSeriesByExam);
router.put('/test-series/:id', adminAuth_1.requireAdmin, testSeries_controller_1.updateTestSeries); // NEW
router.delete('/test-series/:id', adminAuth_1.requireAdmin, testSeries_controller_1.deleteTestSeries); // NEW
exports.default = router;
