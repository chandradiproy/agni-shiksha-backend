// src/routes/auth.routes.ts

import { Router } from 'express';
import { 
  requestOtp, 
  verifyOtp, 
  googleLogin, 
  register, 
  loginWithPassword 
} from '../controllers/auth.controller';

const router = Router();

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register', register);
router.post('/login', loginWithPassword);
router.post('/google', googleLogin);

export default router;