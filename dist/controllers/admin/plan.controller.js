"use strict";
// src/controllers/admin/plan.controller.ts
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
exports.deletePlan = exports.updatePlan = exports.getAllPlans = exports.createPlan = void 0;
const db_1 = __importDefault(require("../../config/db"));
const cache_service_1 = require("../../services/cache.service");
const queue_service_1 = require("../../services/queue.service");
const broadcast_1 = require("../../utils/broadcast");
const notification_center_service_1 = require("../../services/notification-center.service");
const CACHE_TAG = 'premium';
// ==========================================
// 1. CREATE A NEW PREMIUM PLAN
// ==========================================
const createPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, slug, monthly_price_paise, annual_price_paise, features, is_active, display_order } = req.body;
        const adminId = req.admin.id;
        if (!name || !slug || monthly_price_paise === undefined || annual_price_paise === undefined || !features) {
            return res.status(400).json({ error: 'Missing required fields: name, slug, prices, or features.' });
        }
        const newPlan = yield db_1.default.plan.create({
            data: {
                name,
                slug,
                monthly_price_paise: Number(monthly_price_paise),
                annual_price_paise: Number(annual_price_paise),
                features, // Handled as JSON
                is_active: is_active !== null && is_active !== void 0 ? is_active : true,
                display_order: Number(display_order) || 1
            }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'CREATED_PLAN',
                target_id: newPlan.id,
                details: { plan_name: name }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        (0, broadcast_1.broadcastCacheInvalidation)(CACHE_TAG);
        // Auto-Alert Push
        yield notification_center_service_1.NotificationCenterService.createAdminNotification({
            adminId,
            title: 'New Premium Plan!',
            body: `Checkout our new subscription plan: ${newPlan.name}`,
            type: 'MARKETING',
            audienceType: 'ALL',
            sendPush: true,
        }).catch(err => console.error('Auto-Alert Push Error:', err));
        res.status(201).json({ success: true, message: 'Plan created successfully', data: newPlan });
    }
    catch (error) {
        console.error('Create Plan Error:', error);
        if (error.code === 'P2002')
            return res.status(400).json({ error: 'Plan slug must be unique' });
        res.status(500).json({ error: 'Failed to create plan' });
    }
});
exports.createPlan = createPlan;
// ==========================================
// 2. GET ALL PLANS (Including Inactive)
// ==========================================
const getAllPlans = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const plans = yield db_1.default.plan.findMany({
            orderBy: { display_order: 'asc' },
            include: {
                _count: {
                    select: { subscriptions: true } // Let admin see how many users bought this plan
                }
            }
        });
        res.status(200).json({ success: true, data: plans });
    }
    catch (error) {
        console.error('Fetch Plans Error:', error);
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
});
exports.getAllPlans = getAllPlans;
// ==========================================
// 3. UPDATE A PLAN
// ==========================================
const updatePlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const adminId = req.admin.id;
        const updateData = req.body;
        const existingPlan = yield db_1.default.plan.findUnique({ where: { id: id } });
        if (!existingPlan)
            return res.status(404).json({ error: 'Plan not found' });
        // Format numbers if they exist in the payload
        if (updateData.monthly_price_paise !== undefined)
            updateData.monthly_price_paise = Number(updateData.monthly_price_paise);
        if (updateData.annual_price_paise !== undefined)
            updateData.annual_price_paise = Number(updateData.annual_price_paise);
        if (updateData.display_order !== undefined)
            updateData.display_order = Number(updateData.display_order);
        const updatedPlan = yield db_1.default.plan.update({
            where: { id: id },
            data: updateData
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'UPDATED_PLAN',
                target_id: id,
                details: { fields_updated: Object.keys(updateData) }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        (0, broadcast_1.broadcastCacheInvalidation)(CACHE_TAG);
        res.status(200).json({ success: true, message: 'Plan updated successfully', data: updatedPlan });
    }
    catch (error) {
        console.error('Update Plan Error:', error);
        res.status(500).json({ error: 'Failed to update plan' });
    }
});
exports.updatePlan = updatePlan;
// ==========================================
// 4. DELETE A PLAN (Safeguarded)
// ==========================================
const deletePlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const adminId = req.admin.id;
        // 1. Fetch existing plan and count tied subscriptions/payments
        const existingPlan = yield db_1.default.plan.findUnique({
            where: { id: id },
            include: {
                _count: {
                    select: { subscriptions: true, payments: true }
                }
            }
        });
        if (!existingPlan)
            return res.status(404).json({ error: 'Plan not found' });
        // 2. VALIDATION LOCK: Do not allow hard-deletion of plans that have financial records attached!
        if (existingPlan._count.subscriptions > 0 || existingPlan._count.payments > 0) {
            return res.status(403).json({
                error: `Cannot delete this plan because ${existingPlan._count.subscriptions} subscriptions and ${existingPlan._count.payments} payments are tied to it. Please use the update API to set "is_active": false instead.`
            });
        }
        // 3. Perform hard deletion safely
        yield db_1.default.plan.delete({
            where: { id: id }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'DELETED_PLAN',
                target_id: id,
                details: { plan_name: existingPlan.name }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        (0, broadcast_1.broadcastCacheInvalidation)(CACHE_TAG);
        res.status(200).json({ success: true, message: 'Plan deleted successfully' });
    }
    catch (error) {
        console.error('Delete Plan Error:', error);
        res.status(500).json({ error: 'Failed to delete plan' });
    }
});
exports.deletePlan = deletePlan;
