// src/routes/auth.routes.ts

import { Router } from 'express';
import { requestOtp, verifyOtp, googleLogin } from '../controllers/auth.controller';

const router = Router();

// Endpoint to request an Email OTP
router.post('/request-otp', requestOtp);

// Endpoint to verify the OTP and get a JWT
router.post('/verify-otp', verifyOtp);

// Endpoint for Google Single Sign-On
router.post('/google', googleLogin);

export default router;