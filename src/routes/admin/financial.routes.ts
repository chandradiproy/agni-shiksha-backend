// src/routes/admin/financial.routes.ts

import { Router } from 'express';
import { requireAdmin } from '../../middlewares/adminAuth';
import { 
  getAllPayments, 
  getAllSubscriptions,
  getFinancialSummary,
  revokeSubscription,
  verifyPaymentSync,
  refundPayment
} from '../../controllers/admin/financial.controller';

const router = Router();

// Secure all financial routes
router.use(requireAdmin);

// GET /api/v1/admin/financial/payments
router.get('/payments', getAllPayments);

// GET /api/v1/admin/financial/subscriptions
router.get('/subscriptions', getAllSubscriptions);

// GET /api/v1/admin/financial/summary
router.get('/summary', getFinancialSummary);

// POST /api/v1/admin/financial/payments/:paymentId/verify
router.post('/payments/:paymentId/verify', verifyPaymentSync);

// POST /api/v1/admin/financial/subscriptions/:subscriptionId/revoke
router.post('/subscriptions/:subscriptionId/revoke', revokeSubscription);

// POST /api/v1/admin/financial/payments/:paymentId/refund
router.post('/payments/:paymentId/refund', refundPayment);

export default router;