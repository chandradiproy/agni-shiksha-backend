"use strict";
// src/routes/admin/question.routes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const adminAuth_1 = require("../../middlewares/adminAuth");
const question_controller_1 = require("../../controllers/admin/question.controller");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});
// ==========================================
// BULK UPLOAD FLOW
// ==========================================
router.post('/test-series/:testSeriesId/preview-bulk', adminAuth_1.requireAdmin, upload.single('file'), question_controller_1.previewBulkQuestions);
router.post('/test-series/:testSeriesId/commit-bulk', adminAuth_1.requireAdmin, question_controller_1.commitBulkQuestions);
// ==========================================
// INDIVIDUAL QUESTION MANAGEMENT
// ==========================================
// Fetch all questions to populate the Admin UI table
router.get('/test-series/:testSeriesId', adminAuth_1.requireAdmin, question_controller_1.getTestSeriesQuestions);
// Update a specific question (using the same strict validation and sanitization as bulk)
router.put('/test-series/:testSeriesId/question/:questionId', adminAuth_1.requireAdmin, question_controller_1.updateQuestion);
// Delete a specific question
router.delete('/test-series/:testSeriesId/question/:questionId', adminAuth_1.requireAdmin, question_controller_1.deleteQuestion);
exports.default = router;
