// src/routes/student/premium.routes.ts

import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { getActivePlans, createOrder, validateCoupon, handleRazorpayWebhook } from '../../controllers/student/premium.controller';

const router = Router();

// Webhook (No Auth)
router.post('/webhook', handleRazorpayWebhook);

// Protected App Routes
router.use(requireAuth);

router.get('/plans', getActivePlans);
router.post('/validate-coupon', validateCoupon); // NEW endpoint for checkout screen
router.post('/order', createOrder);

export default router;