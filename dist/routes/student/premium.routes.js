"use strict";
// src/routes/student/premium.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const premium_controller_1 = require("../../controllers/student/premium.controller");
const router = (0, express_1.Router)();
// Webhook (No Auth)
router.post('/webhook', premium_controller_1.handleRazorpayWebhook);
// Protected App Routes
router.use(auth_1.requireAuth);
router.get('/plans', premium_controller_1.getActivePlans);
router.post('/validate-coupon', premium_controller_1.validateCoupon); // NEW endpoint for checkout screen
router.post('/order', premium_controller_1.createOrder);
exports.default = router;
