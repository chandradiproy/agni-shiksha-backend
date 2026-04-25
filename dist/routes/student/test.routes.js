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
// 2. Get attempt history
router.get('/my-attempts', test_controller_1.getMyAttempts);
// 3. Get specific test details and previous attempt history
router.get('/:id', test_controller_1.getTestDetails);
// 4. Start a test (Initializes attempt, returns secure questions)
router.post('/:id/start', test_controller_1.startTest);
// 5. Submit test answers (Scoring Engine Transaction)
router.post('/attempts/:attemptId/submit', test_controller_1.submitTest);
// 6. Sync answers locally buffer
router.put('/attempts/:attemptId/sync', test_controller_1.syncAttemptAnswers);
// 7. Report a question
router.post('/attempts/:attemptId/report', test_controller_1.reportQuestion);
exports.default = router;
