"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/admin/coupon.routes.ts
const express_1 = require("express");
const adminAuth_1 = require("../../middlewares/adminAuth");
const coupon_controller_1 = require("../../controllers/admin/coupon.controller");
const router = (0, express_1.Router)();
router.use(adminAuth_1.requireAdmin);
router.post('/', coupon_controller_1.createCoupon);
router.get('/', coupon_controller_1.getAllCoupons);
router.put('/:id', coupon_controller_1.updateCoupon);
router.delete('/:id', coupon_controller_1.deleteCoupon);
router.put('/:id/status', coupon_controller_1.toggleCouponStatus);
exports.default = router;
