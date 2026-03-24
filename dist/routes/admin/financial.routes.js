"use strict";
// src/routes/admin/financial.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_1 = require("../../middlewares/adminAuth");
const financial_controller_1 = require("../../controllers/admin/financial.controller");
const router = (0, express_1.Router)();
// Secure all financial routes
router.use(adminAuth_1.requireAdmin);
// GET /api/v1/admin/financial/payments
router.get('/payments', financial_controller_1.getAllPayments);
// GET /api/v1/admin/financial/subscriptions
router.get('/subscriptions', financial_controller_1.getAllSubscriptions);
// GET /api/v1/admin/financial/summary
router.get('/summary', financial_controller_1.getFinancialSummary);
// POST /api/v1/admin/financial/payments/:paymentId/verify
router.post('/payments/:paymentId/verify', financial_controller_1.verifyPaymentSync);
// POST /api/v1/admin/financial/subscriptions/:subscriptionId/revoke
router.post('/subscriptions/:subscriptionId/revoke', financial_controller_1.revokeSubscription);
// POST /api/v1/admin/financial/payments/:paymentId/refund
router.post('/payments/:paymentId/refund', financial_controller_1.refundPayment);
exports.default = router;
