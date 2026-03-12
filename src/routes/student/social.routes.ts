// src/routes/student/social.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { 
  getDoubts, 
  createDoubt, 
  getAnswers, 
  postAnswer, 
  toggleUpvote, 
  reportContent 
} from '../../controllers/student/social.controller';

const router = Router();

// Secure all social interactions behind auth
router.use(requireAuth);

// ------------------------------------------------------------------
// Doubts Feed
// ------------------------------------------------------------------
// Fetch infinite-scroll feed (Supports ?limit=20&cursor=UUID&subject=Math)
router.get('/doubts', getDoubts);

// Ask a new question
router.post('/doubts', createDoubt);

// ------------------------------------------------------------------
// Doubt Answers
// ------------------------------------------------------------------
// Fetch all answers for a specific doubt
router.get('/doubts/:doubtId/answers', getAnswers);

// Post an answer
router.post('/doubts/:doubtId/answers', postAnswer);

// ------------------------------------------------------------------
// Interactions (Upvotes & Reports)
// ------------------------------------------------------------------
// Toggle an upvote on a doubt OR answer (Body: { "type": "DOUBT" | "ANSWER" })
router.post('/interactions/:targetId/upvote', toggleUpvote);

// Report a doubt OR answer to the Admin (Body: { "type": "DOUBT" | "ANSWER", "reason": "..." })
router.post('/interactions/:targetId/report', reportContent);

export default router;