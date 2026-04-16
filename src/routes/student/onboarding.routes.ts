import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { 
  getExams, 
  getExamSubjects, 
  setupOnboarding, 
  completeOnboarding, 
  getTutorialData 
} from '../../controllers/student/onboarding.controller';

const router = Router();

// These routes can be accessed with or without auth, but for user-level onboarding it requires auth.
// Let's protect the setup and complete specifically, while getting exams could be public.
// However, assuming they are within an onboarding flow AFTER registration, requireAuth is fine globally for these.

router.get('/exams', getExams);
router.get('/tutorial-data', getTutorialData);
router.get('/subjects/:examId', getExamSubjects);

// Secured paths
router.post('/setup', requireAuth, setupOnboarding);
router.post('/complete', requireAuth, completeOnboarding);

export default router;
