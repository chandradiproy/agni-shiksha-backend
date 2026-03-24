"use strict";
// src/controllers/student/premium.controller.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRazorpayWebhook = exports.createOrder = exports.validateCoupon = exports.getActivePlans = void 0;
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = __importDefault(require("../../config/db"));
const cache_service_1 = require("../../services/cache.service");
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key_id',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret',
});
// Helper function to validate and calculate discounts securely
const calculateDiscountedPrice = (planId, billingCycle, couponCode) => __awaiter(void 0, void 0, void 0, function* () {
    const plan = yield db_1.default.plan.findUnique({ where: { id: planId, is_active: true } });
    if (!plan)
        throw new Error('Selected plan is not available');
    let baseAmountPaise = billingCycle === 'annual' ? plan.annual_price_paise : plan.monthly_price_paise;
    let finalAmountPaise = baseAmountPaise;
    let couponDetails = null;
    if (couponCode) {
        const coupon = yield db_1.default.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
        if (!coupon)
            throw new Error('Invalid coupon code');
        if (!coupon.is_active)
            throw new Error('Coupon is currently inactive');
        if (coupon.valid_until && new Date() > coupon.valid_until)
            throw new Error('Coupon has expired');
        if (coupon.max_uses && coupon.current_uses >= coupon.max_uses)
            throw new Error('Coupon usage limit reached');
        if (coupon.applicable_plan_id && coupon.applicable_plan_id !== plan.id)
            throw new Error('Coupon is not applicable for this plan');
        // Calculate Discount
        if (coupon.discount_type === 'PERCENTAGE') {
            const discountAmount = (baseAmountPaise * coupon.discount_value) / 100;
            finalAmountPaise = baseAmountPaise - discountAmount;
        }
        else if (coupon.discount_type === 'FLAT') {
            // Flat value is stored in INR, convert to Paise
            const discountAmountPaise = coupon.discount_value * 100;
            finalAmountPaise = baseAmountPaise - discountAmountPaise;
        }
        // Razorpay minimum payment is 1 INR (100 Paise)
        finalAmountPaise = Math.max(finalAmountPaise, 100);
        couponDetails = coupon;
    }
    return { plan, baseAmountPaise, finalAmountPaise, coupon: couponDetails };
});
// ==========================================
// 1. GET ACTIVE PLANS
// ==========================================
const getActivePlans = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cacheScope = 'premium:active_plans';
        let plans = yield cache_service_1.CacheService.get('premium', cacheScope);
        if (!plans) {
            plans = yield db_1.default.plan.findMany({
                where: { is_active: true },
                orderBy: { display_order: 'asc' },
                select: { id: true, name: true, slug: true, monthly_price_paise: true, annual_price_paise: true, features: true }
            });
            yield cache_service_1.CacheService.set('premium', cacheScope, plans, 1800);
        }
        res.status(200).json({ success: true, data: plans });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch premium plans' });
    }
});
exports.getActivePlans = getActivePlans;
// ==========================================
// 2. VALIDATE COUPON (For Mobile App Checkout UI)
// ==========================================
const validateCoupon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { planId, billingCycle, couponCode } = req.body;
        if (!planId || !billingCycle || !couponCode) {
            return res.status(400).json({ error: 'Plan ID, billing cycle, and coupon code are required' });
        }
        const { baseAmountPaise, finalAmountPaise } = yield calculateDiscountedPrice(planId, billingCycle, couponCode);
        res.status(200).json({
            success: true,
            data: {
                original_price_inr: baseAmountPaise / 100,
                discounted_price_inr: finalAmountPaise / 100,
                savings_inr: (baseAmountPaise - finalAmountPaise) / 100
            }
        });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.validateCoupon = validateCoupon;
// ==========================================
// 3. GENERATE RAZORPAY ORDER (Secure)
// ==========================================
const createOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { planId, billingCycle, couponCode } = req.body;
        if (!planId || !billingCycle || !['monthly', 'annual'].includes(billingCycle)) {
            return res.status(400).json({ error: 'Plan ID and valid billing cycle are required' });
        }
        // Calculate final price securely on the backend
        const { plan, finalAmountPaise, coupon } = yield calculateDiscountedPrice(planId, billingCycle, couponCode);
        const options = {
            amount: finalAmountPaise,
            currency: "INR",
            receipt: `receipt_order_${Date.now()}_${userId.substring(0, 5)}`,
        };
        const order = yield razorpay.orders.create(options);
        // Log the transaction attempt including the coupon used!
        yield db_1.default.payment.create({
            data: {
                user_id: userId,
                gateway_order_id: order.id,
                amount_paise: finalAmountPaise,
                plan_id: plan.id,
                status: 'created',
                description: billingCycle,
                coupon_id: coupon ? coupon.id : null // Save the coupon ID to track usage
            }
        });
        res.status(200).json({
            success: true,
            data: {
                order_id: order.id,
                amount: order.amount,
                currency: order.currency,
                plan_name: plan.name,
                coupon_applied: !!coupon
            }
        });
    }
    catch (error) {
        res.status(error.message === 'Failed to initialize payment gateway' ? 500 : 400).json({
            error: error.message || 'Failed to initialize payment gateway'
        });
    }
});
exports.createOrder = createOrder;
// ==========================================
// 4. RAZORPAY WEBHOOK
// ==========================================
const handleRazorpayWebhook = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_webhook_secret';
        const signature = req.headers['x-razorpay-signature'];
        const shasum = crypto_1.default.createHmac('sha256', secret);
        shasum.update(JSON.stringify(req.body));
        const digest = shasum.digest('hex');
        if (digest !== signature) {
            console.error('[SECURITY ALERT] Invalid Razorpay Webhook Signature!');
            return res.status(400).json({ status: 'Invalid signature' });
        }
        const event = req.body.event;
        const paymentEntity = req.body.payload.payment.entity;
        if (event === 'payment.captured') {
            const orderId = paymentEntity.order_id;
            const paymentId = paymentEntity.id;
            const paymentRecord = yield db_1.default.payment.findUnique({
                where: { gateway_order_id: orderId }
            });
            if (!paymentRecord)
                return res.status(404).json({ status: 'Order not found' });
            if (paymentRecord.status === 'success')
                return res.status(200).json({ status: 'Already processed' });
            yield db_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                // 1. Update Payment status
                yield tx.payment.update({
                    where: { id: paymentRecord.id },
                    data: { status: 'success', gateway_payment_id: paymentId }
                });
                // 2. INCREMENT COUPON USAGE IF ONE WAS USED
                if (paymentRecord.coupon_id) {
                    yield tx.coupon.update({
                        where: { id: paymentRecord.coupon_id },
                        data: { current_uses: { increment: 1 } }
                    });
                }
                const durationMonths = paymentRecord.description === 'annual' ? 12 : 1;
                const startedAt = new Date();
                const expiresAt = new Date();
                expiresAt.setMonth(expiresAt.getMonth() + durationMonths);
                // 3. Create Subscription Record
                yield tx.subscription.create({
                    data: {
                        user_id: paymentRecord.user_id,
                        plan_id: paymentRecord.plan_id,
                        started_at: startedAt,
                        expires_at: expiresAt,
                        status: 'active',
                        payment_gateway: 'razorpay'
                    }
                });
                // 4. Upgrade User
                yield tx.user.update({
                    where: { id: paymentRecord.user_id },
                    data: { is_premium: true, premium_plan_id: paymentRecord.plan_id, premium_expires_at: expiresAt }
                });
            }));
            console.log(`[Webhook] User ${paymentRecord.user_id} upgraded!`);
        }
        if (event === 'payment.failed') {
            const orderId = paymentEntity.order_id;
            yield db_1.default.payment.update({
                where: { gateway_order_id: orderId },
                data: { status: 'failed', description: paymentEntity.error_description }
            });
        }
        res.status(200).json({ status: 'ok' });
    }
    catch (error) {
        console.error('Webhook Handling Error:', error);
        res.status(500).json({ error: 'Internal server error processing webhook' });
    }
});
exports.handleRazorpayWebhook = handleRazorpayWebhook;
