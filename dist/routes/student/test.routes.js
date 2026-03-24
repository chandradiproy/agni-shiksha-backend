"use strict";
// src/routes/student/test.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const test_controller_1 = require("../../controllers/student/test.controller");
const router = (0, express_1.Router)();
// Protect all test routes
router.use(auth_1.requireAuth);
// 1. List available tests (supports filtering via query params)
router.get('/', test_controller_1.getAvailableTests);
// 2. Get specific test details and previous attempt history
router.get('/:id', test_controller_1.getTestDetails);
// 3. Start a test (Initializes attempt, returns secure questions)
router.post('/:id/start', test_controller_1.startTest);
// 4. Submit test answers (Scoring Engine Transaction)
router.post('/attempts/:attemptId/submit', test_controller_1.submitTest);
exports.default = router;
