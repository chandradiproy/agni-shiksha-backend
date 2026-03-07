// src/routes/student/test.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { 
  getAvailableExams, 
  getAvailableTestSeries,
  startTestAttempt,
  getSecureTestQuestions
} from '../../controllers/student/test.controller';

const router = Router();

// ==========================================
// TEST DISCOVERY
// ==========================================
router.get('/exams', requireAuth, getAvailableExams);
router.get('/exams/:examId/test-series', requireAuth, getAvailableTestSeries);

// ==========================================
// TEST EXECUTION ENGINE
// ==========================================
// Start the test (Locks in the attempt, returns attempt ID)
router.post('/test-series/:testSeriesId/start', requireAuth, startTestAttempt);

// Fetch the questions for the active attempt (Securely stripped of answers)
router.get('/test-series/:testSeriesId/attempts/:attemptId/questions', requireAuth, getSecureTestQuestions);

export default router;