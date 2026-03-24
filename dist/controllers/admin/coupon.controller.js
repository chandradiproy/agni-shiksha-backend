"use strict";
// src/controllers/admin/coupon.controller.ts
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
exports.toggleCouponStatus = exports.deleteCoupon = exports.updateCoupon = exports.getAllCoupons = exports.createCoupon = void 0;
const db_1 = __importDefault(require("../../config/db"));
const cache_service_1 = require("../../services/cache.service");
const queue_service_1 = require("../../services/queue.service");
const CACHE_TAG = 'premium';
// ==========================================
// 1. CREATE COUPON
// ==========================================
const createCoupon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { code, discount_type, discount_value, max_uses, valid_until, applicable_plan_id, is_active } = req.body;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        if (!code || !discount_type || discount_value === undefined) {
            return res.status(400).json({ error: 'Code, discount type, and value are required.' });
        }
        const newCoupon = yield db_1.default.coupon.create({
            data: {
                code: code.toUpperCase(), // Normalize to uppercase
                discount_type,
                discount_value: Number(discount_value),
                max_uses: max_uses ? Number(max_uses) : null,
                valid_until: valid_until ? new Date(valid_until) : null,
                applicable_plan_id: applicable_plan_id || null,
                is_active: is_active !== null && is_active !== void 0 ? is_active : true // Accept status from frontend, default to true
            }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'CREATED_COUPON',
                target_id: newCoupon.id,
                details: { code: newCoupon.code, discount_value }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        res.status(201).json({ success: true, message: 'Coupon created successfully', data: newCoupon });
    }
    catch (error) {
        console.error('Create Coupon Error:', error);
        if (error.code === 'P2002')
            return res.status(400).json({ error: 'Coupon code already exists' });
        res.status(500).json({ error: 'Failed to create coupon' });
    }
});
exports.createCoupon = createCoupon;
// ==========================================
// 2. GET ALL COUPONS
// ==========================================
const getAllCoupons = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const coupons = yield db_1.default.coupon.findMany({
            orderBy: { created_at: 'desc' },
            include: {
                applicable_plan: { select: { name: true } },
                _count: { select: { payments: true } } // Show admin how many times it was actually used in payments
            }
        });
        res.status(200).json({ success: true, data: coupons });
    }
    catch (error) {
        console.error('Fetch Coupons Error:', error);
        res.status(500).json({ error: 'Failed to fetch coupons' });
    }
});
exports.getAllCoupons = getAllCoupons;
// ==========================================
// 3. UPDATE COUPON
// ==========================================
const updateCoupon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const { code, discount_type, discount_value, max_uses, valid_until, applicable_plan_id, is_active } = req.body;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const existingCoupon = yield db_1.default.coupon.findUnique({ where: { id: id } });
        if (!existingCoupon)
            return res.status(404).json({ error: 'Coupon not found' });
        const updatedCoupon = yield db_1.default.coupon.update({
            where: { id: id },
            data: {
                code: code ? code.toUpperCase() : undefined,
                discount_type,
                discount_value: discount_value !== undefined ? Number(discount_value) : undefined,
                max_uses: max_uses !== undefined ? (max_uses === null ? null : Number(max_uses)) : undefined,
                valid_until: valid_until !== undefined ? (valid_until === null ? null : new Date(valid_until)) : undefined,
                applicable_plan_id: applicable_plan_id !== undefined ? applicable_plan_id : undefined,
                is_active: is_active !== undefined ? is_active : undefined
            }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'UPDATED_COUPON',
                target_id: updatedCoupon.id,
                details: { code: updatedCoupon.code }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        res.status(200).json({ success: true, message: 'Coupon updated successfully', data: updatedCoupon });
    }
    catch (error) {
        console.error('Update Coupon Error:', error);
        if (error.code === 'P2002')
            return res.status(400).json({ error: 'Coupon code already exists' });
        res.status(500).json({ error: 'Failed to update coupon' });
    }
});
exports.updateCoupon = updateCoupon;
// ==========================================
// 4. DELETE COUPON (Safeguarded)
// ==========================================
const deleteCoupon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const existingCoupon = yield db_1.default.coupon.findUnique({
            where: { id: id },
            include: { _count: { select: { payments: true } } }
        });
        if (!existingCoupon)
            return res.status(404).json({ error: 'Coupon not found' });
        // SAFEGUARD: Do not delete if it has been used in a transaction, as it breaks financial history.
        if (existingCoupon._count.payments > 0) {
            return res.status(403).json({
                error: `Cannot delete coupon because it has been used in ${existingCoupon._count.payments} payment(s). Please deactivate it instead by setting is_active to false.`
            });
        }
        yield db_1.default.coupon.delete({ where: { id: id } });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'DELETED_COUPON',
                target_id: id,
                details: { code: existingCoupon.code }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
    }
    catch (error) {
        console.error('Delete Coupon Error:', error);
        res.status(500).json({ error: 'Failed to delete coupon' });
    }
});
exports.deleteCoupon = deleteCoupon;
// ==========================================
// 5. TOGGLE COUPON STATUS
// ==========================================
const toggleCouponStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const { is_active } = req.body;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        if (is_active === undefined) {
            return res.status(400).json({ error: 'Status (is_active) is required' });
        }
        const coupon = yield db_1.default.coupon.update({
            where: { id: id },
            data: { is_active }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: is_active ? 'ACTIVATED_COUPON' : 'DEACTIVATED_COUPON',
                target_id: coupon.id,
                details: { code: coupon.code }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        res.status(200).json({ success: true, message: 'Coupon status updated', data: coupon });
    }
    catch (error) {
        console.error('Toggle Coupon Status Error:', error);
        res.status(500).json({ error: 'Failed to update coupon status' });
    }
});
exports.toggleCouponStatus = toggleCouponStatus;
