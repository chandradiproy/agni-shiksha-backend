"use strict";
// src/controllers/admin/exam.controller.ts
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
exports.deleteExam = exports.updateExam = exports.getAllExams = exports.createExam = void 0;
const db_1 = __importDefault(require("../../config/db"));
const cache_service_1 = require("../../services/cache.service");
const queue_service_1 = require("../../services/queue.service");
const assessment_lock_service_1 = require("../../services/assessment-lock.service");
const CACHE_TAG = 'exams';
// Create a new Exam category (e.g., SSC CGL)
const createExam = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, slug, category, conducting_body, description, display_order } = req.body;
        const adminId = req.admin.id;
        if (!name || !slug || !category || !conducting_body) {
            return res.status(400).json({ error: 'Name, slug, category, and conducting_body are required' });
        }
        const newExam = yield db_1.default.exam.create({
            data: {
                name,
                slug,
                category,
                conducting_body,
                description,
                display_order: display_order || 1,
                subjects: req.body.subjects || [],
                exam_pattern: req.body.exam_pattern || {},
                created_by: adminId
            }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'CREATED_EXAM',
                target_id: newExam.id,
                details: { name, slug }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        res.status(201).json({ message: 'Exam created successfully', exam: newExam });
    }
    catch (error) {
        console.error('Create Exam Error:', error);
        if (error.code === 'P2002')
            return res.status(400).json({ error: 'Exam slug must be unique' });
        res.status(500).json({ error: 'Failed to create exam' });
    }
});
exports.createExam = createExam;
// Get all Exams
const getAllExams = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;
        // Build the search query
        const whereClause = search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } }
            ]
        } : {};
        const [exams, totalCount] = yield Promise.all([
            db_1.default.exam.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { display_order: 'asc' }
            }),
            db_1.default.exam.count({ where: whereClause })
        ]);
        res.status(200).json({
            data: exams,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    }
    catch (error) {
        console.error('Fetch Exams Error:', error);
        res.status(500).json({ error: 'Failed to fetch exams' });
    }
});
exports.getAllExams = getAllExams;
// Update an Exam
const updateExam = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const adminId = req.admin.id;
        const mutationBlock = yield (0, assessment_lock_service_1.getExamMutationBlock)(id, 'update this exam');
        if (mutationBlock) {
            return res.status(mutationBlock.status).json({ error: mutationBlock.error });
        }
        const updatedExam = yield db_1.default.exam.update({
            where: { id: id },
            data: Object.assign(Object.assign({}, req.body), { updated_by: adminId })
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'UPDATED_EXAM',
                target_id: updatedExam.id
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        res.status(200).json({ message: 'Exam updated successfully', exam: updatedExam });
    }
    catch (error) {
        console.error('Update Exam Error:', error);
        res.status(500).json({ error: 'Failed to update exam' });
    }
});
exports.updateExam = updateExam;
// Delete an Exam
const deleteExam = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        if (!id) {
            return res.status(400).json({ error: 'Exam ID is required' });
        }
        const mutationBlock = yield (0, assessment_lock_service_1.getExamMutationBlock)(id, 'delete this exam');
        if (mutationBlock) {
            return res.status(mutationBlock.status).json({ error: mutationBlock.error });
        }
        // 1. Fetch existing exam and count related test series
        const existingExam = yield db_1.default.exam.findUnique({
            where: { id: id },
            include: {
                _count: {
                    select: { test_series: true, study_materials: true, study_plans: true }
                }
            }
        });
        if (!existingExam) {
            return res.status(404).json({ error: 'Exam not found' });
        }
        // 2. VALIDATION LOCK: Do not allow deletion if there are dependent records
        if (existingExam._count.test_series > 0 || existingExam._count.study_materials > 0 || existingExam._count.study_plans > 0) {
            return res.status(403).json({
                error: `Cannot delete exam because it still has associated Test Series (${existingExam._count.test_series}), Study Materials (${existingExam._count.study_materials}), or Study Plans (${existingExam._count.study_plans}). Please delete them first.`
            });
        }
        // 3. Perform deletion
        yield db_1.default.exam.delete({
            where: { id: id }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'DELETED_EXAM',
                target_id: id,
                details: { exam_name: existingExam.name }
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        res.status(200).json({ message: 'Exam deleted successfully' });
    }
    catch (error) {
        console.error('Delete Exam Error:', error);
        res.status(500).json({ error: 'Failed to delete exam' });
    }
});
exports.deleteExam = deleteExam;
