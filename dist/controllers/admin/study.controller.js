"use strict";
// src/controllers/admin/study.controller.ts
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
exports.deleteStudyPlanTask = exports.updateStudyPlanTask = exports.addStudyPlanTask = exports.deleteStudyPlan = exports.updateStudyPlan = exports.getStudyPlans = exports.createStudyPlan = exports.deleteStudyMaterial = exports.updateStudyMaterial = exports.getStudyMaterials = exports.createStudyMaterial = void 0;
const db_1 = __importDefault(require("../../config/db"));
const cache_service_1 = require("../../services/cache.service");
const queue_service_1 = require("../../services/queue.service");
const broadcast_1 = require("../../utils/broadcast");
const CACHE_TAG = 'study';
// ==========================================
// STUDY MATERIALS (PDFs / Video Links)
// ==========================================
const createStudyMaterial = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { exam_id, title, subject, topic, material_type, file_url, is_active, is_premium } = req.body;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        if (!exam_id || !title || !subject || !topic || !material_type || !file_url) {
            return res.status(400).json({ error: 'All core material fields are required' });
        }
        const material = yield db_1.default.studyMaterial.create({
            data: {
                exam_id,
                title,
                subject,
                topic,
                material_type,
                file_url,
                is_active: is_active !== null && is_active !== void 0 ? is_active : true,
                is_premium: is_premium !== null && is_premium !== void 0 ? is_premium : false, // Controls the Soft Gate
                created_by: adminId
            }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'CREATED_STUDY_MATERIAL',
                target_id: material.id,
                details: { title }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        (0, broadcast_1.broadcastCacheInvalidation)(CACHE_TAG);
        res.status(201).json({ message: 'Study material added successfully', data: material });
    }
    catch (error) {
        console.error('Create Study Material Error:', error);
        res.status(500).json({ error: 'Failed to create study material' });
    }
});
exports.createStudyMaterial = createStudyMaterial;
const getStudyMaterials = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { examId } = req.query;
        const whereClause = examId ? { exam_id: examId } : {};
        const materials = yield db_1.default.studyMaterial.findMany({
            where: whereClause,
            orderBy: { created_at: 'desc' },
            include: { exam: { select: { name: true } } }
        });
        res.status(200).json({ data: materials });
    }
    catch (error) {
        console.error('Fetch Study Materials Error:', error);
        res.status(500).json({ error: 'Failed to fetch materials' });
    }
});
exports.getStudyMaterials = getStudyMaterials;
const updateStudyMaterial = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const updateData = req.body;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const existingMaterial = yield db_1.default.studyMaterial.findUnique({ where: { id: id } });
        if (!existingMaterial)
            return res.status(404).json({ error: 'Study Material not found' });
        const updatedMaterial = yield db_1.default.studyMaterial.update({
            where: { id: id },
            data: Object.assign(Object.assign({}, updateData), { updated_by: adminId })
        });
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'UPDATED_STUDY_MATERIAL',
                target_id: id,
                details: { fields_updated: Object.keys(updateData) }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        (0, broadcast_1.broadcastCacheInvalidation)(CACHE_TAG);
        res.status(200).json({ message: 'Study material updated successfully', data: updatedMaterial });
    }
    catch (error) {
        console.error('Update Study Material Error:', error);
        res.status(500).json({ error: 'Failed to update study material' });
    }
});
exports.updateStudyMaterial = updateStudyMaterial;
const deleteStudyMaterial = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const existingMaterial = yield db_1.default.studyMaterial.findUnique({ where: { id: id } });
        if (!existingMaterial)
            return res.status(404).json({ error: 'Study Material not found' });
        yield db_1.default.studyMaterial.delete({
            where: { id: id }
        });
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'DELETED_STUDY_MATERIAL',
                target_id: id,
                details: { title: existingMaterial.title }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        (0, broadcast_1.broadcastCacheInvalidation)(CACHE_TAG);
        res.status(200).json({ message: 'Study material deleted successfully' });
    }
    catch (error) {
        console.error('Delete Study Material Error:', error);
        res.status(500).json({ error: 'Failed to delete study material' });
    }
});
exports.deleteStudyMaterial = deleteStudyMaterial;
// ==========================================
// STUDY PLANS (Day-by-Day Syllabus)
// ==========================================
const createStudyPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { exam_id, title, duration_days } = req.body;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        if (!exam_id || !title || !duration_days) {
            return res.status(400).json({ error: 'Exam ID, title, and duration are required' });
        }
        const plan = yield db_1.default.studyPlan.create({
            data: {
                exam_id,
                title,
                duration_days: Number(duration_days),
                created_by: adminId
            }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'CREATED_STUDY_PLAN',
                target_id: plan.id,
                details: { title }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        (0, broadcast_1.broadcastCacheInvalidation)(CACHE_TAG);
        res.status(201).json({ message: 'Study plan created successfully', data: plan });
    }
    catch (error) {
        console.error('Create Study Plan Error:', error);
        res.status(500).json({ error: 'Failed to create study plan' });
    }
});
exports.createStudyPlan = createStudyPlan;
const getStudyPlans = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const plans = yield db_1.default.studyPlan.findMany({
            orderBy: { created_at: 'desc' },
            include: {
                exam: { select: { name: true } },
                _count: { select: { tasks: true } },
                tasks: { include: { material: true } }
            }
        });
        res.status(200).json({ data: plans });
    }
    catch (error) {
        console.error('Fetch Study Plans Error:', error);
        res.status(500).json({ error: 'Failed to fetch study plans' });
    }
});
exports.getStudyPlans = getStudyPlans;
const updateStudyPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const updateData = req.body;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const existingPlan = yield db_1.default.studyPlan.findUnique({ where: { id: id } });
        if (!existingPlan)
            return res.status(404).json({ error: 'Study Plan not found' });
        if (updateData.duration_days) {
            updateData.duration_days = Number(updateData.duration_days);
        }
        const updatedPlan = yield db_1.default.studyPlan.update({
            where: { id: id },
            data: Object.assign(Object.assign({}, updateData), { updated_by: adminId })
        });
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'UPDATED_STUDY_PLAN',
                target_id: id
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        (0, broadcast_1.broadcastCacheInvalidation)(CACHE_TAG);
        res.status(200).json({ message: 'Study plan updated successfully', data: updatedPlan });
    }
    catch (error) {
        console.error('Update Study Plan Error:', error);
        res.status(500).json({ error: 'Failed to update study plan' });
    }
});
exports.updateStudyPlan = updateStudyPlan;
const deleteStudyPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const existingPlan = yield db_1.default.studyPlan.findUnique({ where: { id: id } });
        if (!existingPlan)
            return res.status(404).json({ error: 'Study Plan not found' });
        yield db_1.default.studyPlan.delete({
            where: { id: id }
        });
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'DELETED_STUDY_PLAN',
                target_id: id,
                details: { title: existingPlan.title }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        (0, broadcast_1.broadcastCacheInvalidation)(CACHE_TAG);
        res.status(200).json({ message: 'Study plan deleted successfully' });
    }
    catch (error) {
        console.error('Delete Study Plan Error:', error);
        res.status(500).json({ error: 'Failed to delete study plan' });
    }
});
exports.deleteStudyPlan = deleteStudyPlan;
const addStudyPlanTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { planId } = req.params;
        const { day_number, task_title, task_description, reference_material_id } = req.body;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        if (!day_number || !task_title) {
            return res.status(400).json({ error: 'Day number and task title are required' });
        }
        const plan = yield db_1.default.studyPlan.findUnique({ where: { id: planId } });
        if (!plan)
            return res.status(404).json({ error: 'Study plan not found' });
        if (day_number > plan.duration_days || day_number < 1) {
            return res.status(400).json({ error: `Day number must be between 1 and ${plan.duration_days}` });
        }
        const task = yield db_1.default.studyPlanTask.create({
            data: {
                study_plan_id: planId,
                day_number: Number(day_number),
                task_title,
                task_description,
                reference_material_id
            }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'ADDED_STUDY_PLAN_TASK',
                target_id: task.id,
                details: { task_title, plan_id: planId }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        (0, broadcast_1.broadcastCacheInvalidation)(CACHE_TAG);
        res.status(201).json({ message: 'Task added to plan successfully', data: task });
    }
    catch (error) {
        console.error('Add Study Plan Task Error:', error);
        res.status(500).json({ error: 'Failed to add task to study plan' });
    }
});
exports.addStudyPlanTask = addStudyPlanTask;
const updateStudyPlanTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { taskId } = req.params;
        const updateData = req.body;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const existingTask = yield db_1.default.studyPlanTask.findUnique({ where: { id: taskId } });
        if (!existingTask)
            return res.status(404).json({ error: 'Study plan task not found' });
        if (updateData.day_number) {
            updateData.day_number = Number(updateData.day_number);
            // Validate against parent plan's duration limits
            const plan = yield db_1.default.studyPlan.findUnique({ where: { id: existingTask.study_plan_id } });
            if (plan && (updateData.day_number > plan.duration_days || updateData.day_number < 1)) {
                return res.status(400).json({ error: `Day number must be between 1 and ${plan.duration_days}` });
            }
        }
        const updatedTask = yield db_1.default.studyPlanTask.update({
            where: { id: taskId },
            data: updateData
        });
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'UPDATED_STUDY_PLAN_TASK',
                target_id: taskId,
                details: { plan_id: existingTask.study_plan_id }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        (0, broadcast_1.broadcastCacheInvalidation)(CACHE_TAG);
        res.status(200).json({ message: 'Task updated successfully', data: updatedTask });
    }
    catch (error) {
        console.error('Update Study Plan Task Error:', error);
        res.status(500).json({ error: 'Failed to update study plan task' });
    }
});
exports.updateStudyPlanTask = updateStudyPlanTask;
const deleteStudyPlanTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { taskId } = req.params;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const existingTask = yield db_1.default.studyPlanTask.findUnique({ where: { id: taskId } });
        if (!existingTask)
            return res.status(404).json({ error: 'Study plan task not found' });
        yield db_1.default.studyPlanTask.delete({
            where: { id: taskId }
        });
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'DELETED_STUDY_PLAN_TASK',
                target_id: taskId,
                details: { plan_id: existingTask.study_plan_id }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        (0, broadcast_1.broadcastCacheInvalidation)(CACHE_TAG);
        res.status(200).json({ message: 'Task deleted successfully' });
    }
    catch (error) {
        console.error('Delete Study Plan Task Error:', error);
        res.status(500).json({ error: 'Failed to delete study plan task' });
    }
});
exports.deleteStudyPlanTask = deleteStudyPlanTask;
