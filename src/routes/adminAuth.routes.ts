// src/routes/adminAuth.routes.ts

import { Router } from 'express';
import { requestAdminOtp, adminLogin, seedFirstAdmin } from '../controllers/adminAuth.controller';

const router = Router();

// Endpoint to request an OTP for admin login
router.post('/request-otp', requestAdminOtp);

// Endpoint to verify OTP and Password simultaneously
router.post('/login', adminLogin);

// DEV ONLY: Endpoint to seed the first admin account into the database
router.post('/seed', seedFirstAdmin);

export default router;