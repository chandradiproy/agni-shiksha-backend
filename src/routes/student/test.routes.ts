// src/routes/student/test.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import {
  getAvailableTests,
  getTestDetails,
  startTest,
  submitTest,
  syncAttemptAnswers,
  getMyAttempts,
  reportQuestion
} from '../../controllers/student/test.controller';

const router = Router();

// Protect all test routes
router.use(requireAuth);

// 1. List available tests (supports filtering via query params)
router.get('/', getAvailableTests);

// 2. Get attempt history
router.get('/my-attempts', getMyAttempts);

// 3. Get specific test details and previous attempt history
router.get('/:id', getTestDetails);

// 4. Start a test (Initializes attempt, returns secure questions)
router.post('/:id/start', startTest);

// 5. Submit test answers (Scoring Engine Transaction)
router.post('/attempts/:attemptId/submit', submitTest);

// 6. Sync answers locally buffer
router.put('/attempts/:attemptId/sync', syncAttemptAnswers);

// 7. Report a question
router.post('/attempts/:attemptId/report', reportQuestion);

export default router;
