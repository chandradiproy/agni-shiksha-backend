"use strict";
// src/controllers/admin/question.controller.ts
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
exports.deleteQuestion = exports.updateQuestion = exports.getTestSeriesQuestions = exports.commitBulkQuestions = exports.previewBulkQuestions = void 0;
const stream_1 = require("stream");
const csv_parser_1 = __importDefault(require("csv-parser"));
const zod_1 = require("zod");
const db_1 = __importDefault(require("../../config/db"));
const sanitizer_1 = require("../../utils/sanitizer");
const cache_service_1 = require("../../services/cache.service");
const queue_service_1 = require("../../services/queue.service");
const assessment_lock_service_1 = require("../../services/assessment-lock.service");
const CACHE_TAG = 'tests';
// Zod Schema (works for both CSV strings and Frontend JSON numbers)
const questionRowSchema = zod_1.z.object({
    // REMOVED exam_slug: We now get the exact context directly from the API URL!
    subject: zod_1.z.string().min(1, 'Subject is required'),
    topic: zod_1.z.string().min(1, 'Topic is required'),
    sub_topic: zod_1.z.string().optional(),
    section: zod_1.z.string().min(1, 'Section is required'),
    question_type: zod_1.z.enum(['mcq', 'true_false', 'fill_blank']).default('mcq'),
    question_text: zod_1.z.string().min(5, 'Must be at least 5 characters'),
    question_text_hindi: zod_1.z.string().optional(),
    option_a: zod_1.z.string().min(1, 'Option A is required'),
    option_b: zod_1.z.string().min(1, 'Option B is required'),
    option_c: zod_1.z.string().optional(),
    option_d: zod_1.z.string().optional(),
    correct_option: zod_1.z.enum(['a', 'b', 'c', 'd'], {
        message: 'Must be a, b, c, or d',
    }),
    explanation: zod_1.z.string().min(1, 'Explanation is required'),
    explanation_hindi: zod_1.z.string().optional(),
    difficulty: zod_1.z.enum(['easy', 'medium', 'hard'], {
        message: 'Must be easy, medium, or hard'
    }),
    cognitive_type: zod_1.z.string().default('conceptual'),
    marks: zod_1.z.preprocess((val) => Number(val) || 1, zod_1.z.number()),
    // PREPROCESS FIX: If frontend sends an array, join it into a string so it matches the CSV format!
    tags: zod_1.z.preprocess((val) => Array.isArray(val) ? val.join(',') : val, zod_1.z.string().optional()),
    source: zod_1.z.string().default('original'),
    pyq_year: zod_1.z.preprocess((val) => val ? Number(val) : null, zod_1.z.number().nullable().optional())
});
// ==========================================
// STEP 1: PREVIEW (Reads CSV, Validates, Returns to UI)
// ==========================================
const previewBulkQuestions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { testSeriesId } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'No CSV file uploaded.' });
        }
        // Validate that the Test Series actually exists before parsing the file
        const testSeries = yield db_1.default.testSeries.findUnique({
            where: { id: testSeriesId }
        });
        if (!testSeries) {
            return res.status(404).json({ error: 'Test Series not found. Cannot preview questions.' });
        }
        const rawRows = yield new Promise((resolve, reject) => {
            const rows = [];
            stream_1.Readable.from(req.file.buffer)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => rows.push(data))
                .on('end', () => resolve(rows))
                .on('error', reject);
        });
        if (rawRows.length === 0) {
            return res.status(400).json({ error: 'The CSV file is empty.' });
        }
        const previewData = rawRows.map((row, index) => {
            let isValid = true;
            const fieldErrors = {};
            // 1. Validate with Zod (No need to check validSlugs manually anymore!)
            const validation = questionRowSchema.safeParse(row);
            if (!validation.success) {
                isValid = false;
                validation.error.issues.forEach((issue) => {
                    const fieldName = issue.path[0];
                    fieldErrors[fieldName] = issue.message;
                });
            }
            return {
                id: `row-${index}`,
                data: row,
                isValid,
                errors: fieldErrors
            };
        });
        res.status(200).json({
            message: 'Preview generated',
            totalRows: previewData.length,
            invalidRows: previewData.filter(r => !r.isValid).length,
            preview: previewData
        });
    }
    catch (error) {
        console.error('Preview Error:', error);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});
exports.previewBulkQuestions = previewBulkQuestions;
// ==========================================
// STEP 2: COMMIT (Accepts JSON from UI, Sanitizes, Inserts)
// ==========================================
const commitBulkQuestions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { testSeriesId } = req.params;
        const { questions } = req.body;
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'No questions provided for upload.' });
        }
        // Fetch Test Series to automatically link BOTH exam_id and test_series_id
        const testSeries = yield db_1.default.testSeries.findUnique({
            where: { id: testSeriesId }
        });
        if (!testSeries) {
            return res.status(404).json({ error: 'Test Series not found.' });
        }
        const mutationBlock = yield (0, assessment_lock_service_1.getTestSeriesMutationBlock)(testSeriesId, 'modify questions for this test series');
        if (mutationBlock) {
            return res.status(mutationBlock.status).json({ error: mutationBlock.error });
        }
        const validQuestions = [];
        const finalErrors = [];
        const adminId = req.admin.id;
        questions.forEach((rawRow, index) => {
            const validation = questionRowSchema.safeParse(rawRow);
            if (!validation.success) {
                finalErrors.push({ row: index + 1, error: 'Validation failed after edit' });
                return;
            }
            const row = validation.data;
            // Assemble and sanitize
            const options = [
                { id: 'a', text: (0, sanitizer_1.sanitizeContent)(row.option_a), is_correct: row.correct_option === 'a' },
                { id: 'b', text: (0, sanitizer_1.sanitizeContent)(row.option_b), is_correct: row.correct_option === 'b' },
            ];
            if (row.option_c)
                options.push({ id: 'c', text: (0, sanitizer_1.sanitizeContent)(row.option_c), is_correct: row.correct_option === 'c' });
            if (row.option_d)
                options.push({ id: 'd', text: (0, sanitizer_1.sanitizeContent)(row.option_d), is_correct: row.correct_option === 'd' });
            const tagsArray = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
            validQuestions.push({
                exam_id: testSeries.exam_id, // <--- AUTO-ASSIGNED!
                test_series_id: testSeries.id, // <--- AUTO-ASSIGNED!
                subject: row.subject,
                topic: row.topic,
                sub_topic: row.sub_topic || null,
                section: row.section,
                question_type: row.question_type,
                question_text: (0, sanitizer_1.sanitizeContent)(row.question_text),
                question_text_hindi: (0, sanitizer_1.sanitizeContent)(row.question_text_hindi),
                options,
                correct_option_id: row.correct_option,
                explanation: (0, sanitizer_1.sanitizeContent)(row.explanation),
                explanation_hindi: (0, sanitizer_1.sanitizeContent)(row.explanation_hindi),
                difficulty: row.difficulty,
                question_type_cognitive: row.cognitive_type,
                marks: row.marks,
                tags: tagsArray,
                source: row.source,
                pyq_year: row.pyq_year,
                display_order: index + 1,
                created_by: adminId
            });
        });
        if (validQuestions.length > 0) {
            yield db_1.default.question.createMany({ data: validQuestions });
            // Audit Log
            yield db_1.default.adminAuditLog.create({
                data: {
                    admin_id: adminId,
                    action: 'BULK_CREATED_QUESTIONS',
                    target_id: testSeriesId,
                    details: { count: validQuestions.length }
                }
            });
            yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
            yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        }
        res.status(200).json({
            message: 'Questions successfully uploaded',
            successCount: validQuestions.length,
            errorCount: finalErrors.length,
            errors: finalErrors.length > 0 ? finalErrors : undefined
        });
    }
    catch (error) {
        console.error('Commit Upload Error:', error);
        res.status(500).json({ error: 'Failed to commit questions to database' });
    }
});
exports.commitBulkQuestions = commitBulkQuestions;
// ==========================================
// STEP 3: MANAGE INDIVIDUAL QUESTIONS
// ==========================================
// Get all questions for a specific Test Series (Used for the UI Preview Table)
const getTestSeriesQuestions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { testSeriesId } = req.params;
        const questions = yield db_1.default.question.findMany({
            where: { test_series_id: testSeriesId },
            orderBy: { display_order: 'asc' }
        });
        res.status(200).json({ data: questions });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
});
exports.getTestSeriesQuestions = getTestSeriesQuestions;
// Update a single question
const updateQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { testSeriesId, questionId } = req.params;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const mutationBlock = yield (0, assessment_lock_service_1.getTestSeriesMutationBlock)(testSeriesId, 'modify questions for this test series');
        if (mutationBlock) {
            return res.status(mutationBlock.status).json({ error: mutationBlock.error });
        }
        // 2. Validate the incoming JSON using the same Zod schema from the bulk upload!
        const validation = questionRowSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
            });
        }
        const row = validation.data;
        // 3. Sanitize options & content
        const options = [
            { id: 'a', text: (0, sanitizer_1.sanitizeContent)(row.option_a), is_correct: row.correct_option === 'a' },
            { id: 'b', text: (0, sanitizer_1.sanitizeContent)(row.option_b), is_correct: row.correct_option === 'b' },
        ];
        if (row.option_c)
            options.push({ id: 'c', text: (0, sanitizer_1.sanitizeContent)(row.option_c), is_correct: row.correct_option === 'c' });
        if (row.option_d)
            options.push({ id: 'd', text: (0, sanitizer_1.sanitizeContent)(row.option_d), is_correct: row.correct_option === 'd' });
        const tagsArray = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
        // 4. Update Database
        const updatedQuestion = yield db_1.default.question.update({
            where: { id: questionId },
            data: {
                subject: row.subject,
                topic: row.topic,
                sub_topic: row.sub_topic || null,
                section: row.section,
                question_type: row.question_type,
                question_text: (0, sanitizer_1.sanitizeContent)(row.question_text),
                question_text_hindi: (0, sanitizer_1.sanitizeContent)(row.question_text_hindi),
                options,
                correct_option_id: row.correct_option,
                explanation: (0, sanitizer_1.sanitizeContent)(row.explanation),
                explanation_hindi: (0, sanitizer_1.sanitizeContent)(row.explanation_hindi),
                difficulty: row.difficulty,
                question_type_cognitive: row.cognitive_type,
                marks: row.marks,
                tags: tagsArray,
                source: row.source,
                pyq_year: row.pyq_year,
            }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'UPDATED_QUESTION',
                target_id: updatedQuestion.id
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        res.status(200).json({ message: 'Question updated successfully', question: updatedQuestion });
    }
    catch (error) {
        console.error('Update Question Error:', error);
        res.status(500).json({ error: 'Failed to update question' });
    }
});
exports.updateQuestion = updateQuestion;
// Delete a single question
const deleteQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { testSeriesId, questionId } = req.params;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const mutationBlock = yield (0, assessment_lock_service_1.getTestSeriesMutationBlock)(testSeriesId, 'modify questions for this test series');
        if (mutationBlock) {
            return res.status(mutationBlock.status).json({ error: mutationBlock.error });
        }
        // 2. Delete the Question
        yield db_1.default.question.delete({
            where: { id: questionId }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'DELETED_QUESTION',
                target_id: questionId
            }
        });
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        yield queue_service_1.QueueService.enqueueSilentSync(CACHE_TAG);
        res.status(200).json({ message: 'Question deleted successfully' });
    }
    catch (error) {
        console.error('Delete Question Error:', error);
        res.status(500).json({ error: 'Failed to delete question' });
    }
});
exports.deleteQuestion = deleteQuestion;
