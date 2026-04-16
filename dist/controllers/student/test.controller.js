"use strict";
// src/controllers/student/test.controller.ts
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
exports.submitTest = exports.startTest = exports.getTestDetails = exports.getAvailableTests = exports.submissionQueue = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const db_1 = __importDefault(require("../../config/db"));
const cache_service_1 = require("../../services/cache.service");
// Create a dedicated IORedis connection specifically for BullMQ.
// BullMQ requires native IORedis for blocking operations. It cannot use the REST Proxy.
const queueConnection = new ioredis_1.default(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null // Strictly required by BullMQ
});
exports.submissionQueue = new bullmq_1.Queue('test-submissions', {
    connection: queueConnection // Type assertion to satisfy BullMQ's expected connection type
});
// ==========================================
// 1. GET AVAILABLE TESTS
// ==========================================
const getAvailableTests = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { examId, type } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const whereClause = {
            is_active: true,
            is_published: true,
        };
        if (examId)
            whereClause.exam_id = examId;
        if (type) {
            const upperType = type.toUpperCase();
            whereClause.type = upperType;
        }
        const cacheScope = `available_tests:exam:${examId || 'all'}:type:${type ? type.toUpperCase() : 'all'}:page:${page}:limit:${limit}`;
        const cachedResponse = yield cache_service_1.CacheService.get('tests', cacheScope);
        if (cachedResponse) {
            return res.status(200).json(cachedResponse);
        }
        const [tests, totalCount] = yield Promise.all([
            db_1.default.testSeries.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                select: {
                    id: true,
                    title: true,
                    type: true,
                    test_type: true,
                    difficulty: true,
                    total_questions: true,
                    duration_minutes: true,
                    total_marks: true,
                    available_from: true,
                    available_until: true,
                }
            }),
            db_1.default.testSeries.count({ where: whereClause })
        ]);
        const responsePayload = {
            success: true,
            data: tests,
            pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) }
        };
        yield cache_service_1.CacheService.set('tests', cacheScope, responsePayload, 600);
        res.status(200).json(responsePayload);
    }
    catch (error) {
        console.error('Get Available Tests Error:', error);
        res.status(500).json({ error: 'Failed to fetch available tests' });
    }
});
exports.getAvailableTests = getAvailableTests;
// ==========================================
// 2. GET TEST DETAILS & PREVIOUS ATTEMPTS
// ==========================================
const getTestDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const testInfoScope = `test_details:${id}`;
        let testSeries = yield cache_service_1.CacheService.get('tests', testInfoScope);
        if (!testSeries) {
            testSeries = yield db_1.default.testSeries.findFirst({
                where: { id: id, is_active: true, is_published: true },
            });
            if (testSeries) {
                yield cache_service_1.CacheService.set('tests', testInfoScope, testSeries, 900);
            }
        }
        if (!testSeries) {
            return res.status(404).json({ error: 'Test Series not found or unavailable' });
        }
        // Check how many times the user has already attempted this test
        const previousAttempts = yield db_1.default.testAttempt.findMany({
            where: { test_series_id: testSeries.id, user_id: userId },
            orderBy: { started_at: 'desc' },
            select: { id: true, status: true, score: true, percentage: true, started_at: true }
        });
        res.status(200).json({
            success: true,
            data: {
                test_info: testSeries,
                attempts: previousAttempts,
                can_attempt: previousAttempts.length < testSeries.max_attempts
            }
        });
    }
    catch (error) {
        console.error('Get Test Details Error:', error);
        res.status(500).json({ error: 'Failed to fetch test details' });
    }
});
exports.getTestDetails = getTestDetails;
// ==========================================
// 3. START A TEST
// ==========================================
const startTest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const testSeries = yield db_1.default.testSeries.findUnique({
            where: { id: id }
        });
        if (!testSeries || !testSeries.is_active || !testSeries.is_published) {
            return res.status(404).json({ error: 'Test Series is not available' });
        }
        // Check Max Attempts
        const attemptCount = yield db_1.default.testAttempt.count({
            where: { test_series_id: testSeries.id, user_id: userId }
        });
        if (attemptCount >= testSeries.max_attempts) {
            return res.status(403).json({ error: 'Maximum attempts reached for this test' });
        }
        // Check for an already 'in_progress' attempt to resume
        let attempt = yield db_1.default.testAttempt.findFirst({
            where: { test_series_id: testSeries.id, user_id: userId, status: 'in_progress' }
        });
        // If no active attempt, create a new one
        if (!attempt) {
            attempt = yield db_1.default.testAttempt.create({
                data: {
                    user_id: userId,
                    test_series_id: testSeries.id,
                    status: 'in_progress',
                    score: 0,
                    percentage: 0,
                    attempt_number: attemptCount + 1 // FIX: Added the missing attempt_number field required by Prisma
                }
            });
        }
        // Fetch Questions
        const questionsScope = `start_test_questions:${testSeries.id}`;
        let secureQuestions = yield cache_service_1.CacheService.get('tests', questionsScope);
        if (!secureQuestions) {
            const rawQuestions = yield db_1.default.question.findMany({
                where: { test_series_id: testSeries.id },
                orderBy: { display_order: 'asc' }
            });
            // CRITICAL FIX: Map questions securely.
            // We MUST remove `is_correct` and `correct_option_id` from the payload so tech-savvy students can't cheat!
            secureQuestions = rawQuestions.map((q) => {
                const secureOptions = q.options.map(opt => ({
                    id: opt.id,
                    text: opt.text
                }));
                return {
                    id: q.id,
                    subject: q.subject,
                    topic: q.topic,
                    section: q.section,
                    question_type: q.question_type,
                    question_text: q.question_text,
                    question_text_hindi: q.question_text_hindi,
                    marks: q.marks,
                    options: secureOptions
                };
            });
            yield cache_service_1.CacheService.set('tests', questionsScope, secureQuestions, 3600);
        }
        res.status(200).json({
            success: true,
            data: {
                attempt_id: attempt.id,
                duration_minutes: testSeries.duration_minutes,
                questions: secureQuestions
            }
        });
    }
    catch (error) {
        console.error('Start Test Error:', error);
        res.status(500).json({ error: 'Failed to start test' });
    }
});
exports.startTest = startTest;
// ==========================================
// 4. SUBMIT TEST (Highly Scalable Engine)
// ==========================================
// 4. SUBMIT TEST (Ultimate BullMQ Scalable Engine)
// ==========================================
const submitTest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { attemptId } = req.params;
        const { answers, time_taken_seconds } = req.body;
        const userId = req.user.id;
        const attempt = yield db_1.default.testAttempt.findUnique({
            where: { id: attemptId },
            include: { test_series: true }
        });
        if (!attempt || attempt.user_id !== userId) {
            return res.status(404).json({ error: 'Test attempt not found' });
        }
        if (attempt.status === 'completed') {
            return res.status(400).json({ error: 'This test attempt has already been submitted.' });
        }
        const testSeries = attempt.test_series;
        // SCALABILITY FIX 1: Fetch Answer Key from Redis Cache
        const cacheScope = `test_answer_key:${testSeries.id}`;
        let questions = yield cache_service_1.CacheService.get('tests', cacheScope);
        if (!questions) {
            questions = yield db_1.default.question.findMany({
                where: { test_series_id: testSeries.id }
            });
            yield cache_service_1.CacheService.set('tests', cacheScope, questions, 7200);
        }
        // Scoring Variables
        let totalScore = 0;
        let correctCount = 0;
        let incorrectCount = 0;
        const subjectScores = {};
        const questionsMap = new Map(questions.map((q) => [q.id, q]));
        // Grade each answer in memory (blazing fast - takes < 1ms)
        answers.forEach((ans) => {
            // FIX: Explicitly cast 'q' to 'any' so TypeScript knows it contains the properties parsed from Redis
            const q = questionsMap.get(ans.question_id);
            if (!q)
                return;
            if (!subjectScores[q.subject])
                subjectScores[q.subject] = 0;
            if (ans.selected_option_id === q.correct_option_id) {
                totalScore += Number(q.marks);
                subjectScores[q.subject] += Number(q.marks);
                correctCount++;
            }
            else if (ans.selected_option_id) {
                incorrectCount++;
                if (testSeries.negative_marking && testSeries.negative_marks_per_wrong) {
                    totalScore -= Number(testSeries.negative_marks_per_wrong);
                    subjectScores[q.subject] -= Number(testSeries.negative_marks_per_wrong);
                }
            }
        });
        const finalScore = Math.max(0, totalScore);
        const percentage = (finalScore / testSeries.total_marks) * 100;
        // ========================================================
        // SCALABILITY FIX 2 & 3: BULLMQ OFF-LOADING
        // We instantly push all Database writes to the Queue and 
        // respond to the user without waiting for the DB to lock!
        // ========================================================
        yield exports.submissionQueue.add('process-submission', {
            attemptId,
            userId,
            finalScore,
            percentage: Number(percentage.toFixed(2)),
            subjectScores,
            timeTakenSeconds: time_taken_seconds || 0
        }, {
            removeOnComplete: true, // Keep Redis clean
            attempts: 3, // Retry if DB temporarily locks
            backoff: { type: 'exponential', delay: 2000 }
        });
        // Immediately return the memory-graded score back to the frontend
        // We use HTTP 202 (Accepted) to indicate the job is processing securely in the background
        res.status(202).json({
            success: true,
            message: 'Test submitted and is being securely saved',
            data: {
                score: finalScore,
                percentage: Number(percentage.toFixed(2)),
                correct_count: correctCount,
                incorrect_count: incorrectCount
            }
        });
    }
    catch (error) {
        console.error('Submit Test Error:', error);
        res.status(500).json({ error: 'Failed to submit test' });
    }
});
exports.submitTest = submitTest;
