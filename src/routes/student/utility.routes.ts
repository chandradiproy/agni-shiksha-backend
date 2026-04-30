// src/routes/student/utility.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { 
  toggleBookmark, 
  getBookmarks, 
  checkBookmarks,
  createNote, 
  getNotes, 
  updateNote, 
  deleteNote 
} from '../../controllers/student/utility.controller';

const router = Router();

// Protect all utility routes
router.use(requireAuth);

// Bookmarks
router.get('/bookmarks', getBookmarks);
router.get('/bookmarks/check', checkBookmarks);
router.post('/bookmarks/toggle', toggleBookmark);

// Notes
router.get('/notes', getNotes);
router.post('/notes', createNote);
router.put('/notes/:id', updateNote);
router.delete('/notes/:id', deleteNote);

export default router;