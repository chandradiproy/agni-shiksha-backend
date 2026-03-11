// src/routes/student/test.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import {
  getAvailableTests,
  getTestDetails,
  startTest,
  submitTest
} from '../../controllers/student/test.controller';

const router = Router();

// Protect all test routes
router.use(requireAuth);

// 1. List available tests (supports filtering via query params)
router.get('/', getAvailableTests);

// 2. Get specific test details and previous attempt history
router.get('/:id', getTestDetails);

// 3. Start a test (Initializes attempt, returns secure questions)
router.post('/:id/start', startTest);

// 4. Submit test answers (Scoring Engine Transaction)
router.post('/attempts/:attemptId/submit', submitTest);

export default router;