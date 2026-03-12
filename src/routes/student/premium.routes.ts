// src/routes/student/premium.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { createOrder, handleRazorpayWebhook } from '../../controllers/student/premium.controller';

const router = Router();

// ==========================================
// 1. SECURE WEBHOOK (NO AUTH MIDDLEWARE)
// ==========================================
// Razorpay hits this directly. We rely on the crypto signature for auth.
router.post('/webhook', handleRazorpayWebhook);


// ==========================================
// 2. PROTECTED ROUTES (Student App)
// ==========================================
// The student must be logged in to request an order ID
router.use(requireAuth);

router.post('/order', createOrder);

export default router;