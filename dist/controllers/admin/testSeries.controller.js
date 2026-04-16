"use strict";
// src/controllers/admin/testSeries.controller.ts
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
exports.deleteTestSeries = exports.updateTestSeries = exports.getTestSeriesByExam = exports.createTestSeries = void 0;
const db_1 = __importDefault(require("../../config/db"));
const cache_service_1 = require("../../services/cache.service");
const queue_service_1 = require("../../services/queue.service");
const broadcast_1 = require("../../utils/broadcast");
const assessment_lock_service_1 = require("../../services/assessment-lock.service");
const CACHE_TAG = 'tests';
// Create a new Test Series under an Exam
const createTestSeries = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { exam_id, title, description, type, test_type, subject, total_questions, duration_minutes, total_marks, difficulty, negative_marking, negative_marks_per_wrong, is_all_india, is_active, is_scheduled, is_published, scheduled_at, available_from, available_until, max_attempts, show_solutions, show_solutions_after, instructions, sections, price_if_standalone } = req.body;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        // Strict validation for core required fields based on Schema
        if (!exam_id || !title || !type || !test_type || total_questions === undefined || duration_minutes === undefined || total_marks === undefined || !difficulty) {
            return res.status(400).json({ error: 'Missing required test series core fields' });
        }
        const parsedAvailableFrom = available_from ? new Date(available_from) : new Date();
        const parsedAvailableUntil = available_until ? new Date(available_until) : null;
        // LOGICAL DATE VALIDATION: Ensure 'Until' is strictly after 'From'
        if (parsedAvailableUntil && parsedAvailableFrom >= parsedAvailableUntil) {
            return res.status(400).json({ error: '"Available Until" date must be strictly after the "Available From" date.' });
        }
        const newTestSeries = yield db_1.default.testSeries.create({
            data: {
                exam_id,
                title,
                description,
                type,
                test_type,
                subject,
                total_questions: Number(total_questions),
                duration_minutes: Number(duration_minutes),
                total_marks: Number(total_marks),
                negative_marking: negative_marking || false,
                negative_marks_per_wrong: negative_marks_per_wrong ? Number(negative_marks_per_wrong) : 0.00,
                difficulty,
                is_all_india: is_all_india || false,
                is_active: is_active !== null && is_active !== void 0 ? is_active : true,
                is_scheduled: is_scheduled || false,
                is_published: is_published || false,
                // Parse Dates if provided
                scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
                available_from: parsedAvailableFrom,
                available_until: parsedAvailableUntil,
                max_attempts: max_attempts ? Number(max_attempts) : 3,
                show_solutions: show_solutions !== null && show_solutions !== void 0 ? show_solutions : true,
                show_solutions_after: show_solutions_after || 'immediate',
                instructions,
                sections: sections || [], // Handled as JSON
                price_if_standalone: price_if_standalone ? Number(price_if_standalone) : null,
                created_by: adminId // <-- NEW
            }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'CREATED_TEST_SERIES',
                target_id: newTestSeries.id,
                details: { title }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        res.status(201).json({ message: 'Test Series created successfully', testSeries: newTestSeries });
    }
    catch (error) {
        console.error('Create Test Series Error:', error);
        res.status(500).json({ error: 'Failed to create test series' });
    }
});
exports.createTestSeries = createTestSeries;
// Get Test Series by Exam ID
const getTestSeriesByExam = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { examId } = req.params;
        const testSeries = yield db_1.default.testSeries.findMany({
            where: { exam_id: examId },
            orderBy: { created_at: 'desc' }
        });
        res.status(200).json({ data: testSeries });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch test series' });
    }
});
exports.getTestSeriesByExam = getTestSeriesByExam;
// Update a Test Series
const updateTestSeries = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const updateData = Object.assign(Object.assign({}, req.body), { updated_by: adminId }); // <-- NEW
        const mutationBlock = yield (0, assessment_lock_service_1.getTestSeriesMutationBlock)(id, 'update this test series');
        if (mutationBlock) {
            return res.status(mutationBlock.status).json({ error: mutationBlock.error });
        }
        // 1. Fetch existing test to check publication status
        const existingTest = yield db_1.default.testSeries.findUnique({ where: { id: id } });
        if (!existingTest) {
            return res.status(404).json({ error: 'Test Series not found' });
        }
        // 2. VALIDATION LOCK: If it is already published, we block structural changes.
        if (existingTest.is_published === true) {
            const forbiddenLiveEdits = ['total_questions', 'total_marks', 'duration_minutes', 'negative_marks_per_wrong'];
            const attemptedForbiddenEdits = forbiddenLiveEdits.filter(field => updateData[field] !== undefined);
            if (attemptedForbiddenEdits.length > 0) {
                return res.status(403).json({
                    error: `Cannot modify structural fields (${attemptedForbiddenEdits.join(', ')}) while the test is published. Please unpublish first.`
                });
            }
        }
        // Format Dates if they are being updated
        if (updateData.scheduled_at)
            updateData.scheduled_at = new Date(updateData.scheduled_at);
        if (updateData.available_from)
            updateData.available_from = new Date(updateData.available_from);
        if (updateData.available_until)
            updateData.available_until = new Date(updateData.available_until);
        // 3. LOGICAL DATE VALIDATION
        // We must check the incoming dates, or fallback to existing DB dates if only one is being updated.
        const finalAvailableFrom = updateData.available_from !== undefined ? updateData.available_from : existingTest.available_from;
        const finalAvailableUntil = updateData.available_until !== undefined ? updateData.available_until : existingTest.available_until;
        if (finalAvailableUntil && finalAvailableFrom && finalAvailableFrom >= finalAvailableUntil) {
            return res.status(400).json({ error: '"Available Until" date must be strictly after the "Available From" date.' });
        }
        const updatedTestSeries = yield db_1.default.testSeries.update({
            where: { id: id },
            data: updateData
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'UPDATED_TEST_SERIES',
                target_id: updatedTestSeries.id
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        (0, broadcast_1.broadcastCacheInvalidation)(CACHE_TAG);
        res.status(200).json({ message: 'Test Series updated successfully', testSeries: updatedTestSeries });
    }
    catch (error) {
        console.error('Update Test Series Error:', error);
        res.status(500).json({ error: 'Failed to update test series' });
    }
});
exports.updateTestSeries = updateTestSeries;
// Delete a Test Series
const deleteTestSeries = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const mutationBlock = yield (0, assessment_lock_service_1.getTestSeriesMutationBlock)(id, 'delete this test series');
        if (mutationBlock) {
            return res.status(mutationBlock.status).json({ error: mutationBlock.error });
        }
        yield db_1.default.testSeries.delete({
            where: { id: id }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'DELETED_TEST_SERIES',
                target_id: id
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        (0, broadcast_1.broadcastCacheInvalidation)(CACHE_TAG);
        res.status(200).json({ message: 'Test Series deleted successfully' });
    }
    catch (error) {
        console.error('Delete Test Series Error:', error);
        res.status(500).json({ error: 'Failed to delete test series' });
    }
});
exports.deleteTestSeries = deleteTestSeries;
