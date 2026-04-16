"use strict";
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
exports.getTutorialData = exports.completeOnboarding = exports.setupOnboarding = exports.getExamSubjects = exports.getExams = void 0;
const db_1 = __importDefault(require("../../config/db"));
const cache_service_1 = require("../../services/cache.service");
const onboarding_schema_1 = require("../../schemas/onboarding.schema");
// ==========================================
// 1. GET EXAMS (Global list of exams)
// ==========================================
const getExams = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cacheScope = 'exams:all_active';
        let exams;
        const cachedExams = yield cache_service_1.CacheService.get('onboarding', cacheScope);
        if (cachedExams) {
            exams = cachedExams;
        }
        else {
            exams = yield db_1.default.exam.findMany({
                where: { is_active: true },
                select: {
                    id: true,
                    name: true,
                    category: true,
                    thumbnail_url: true,
                    description: true,
                    display_order: true
                },
                orderBy: { display_order: 'asc' }
            });
            yield cache_service_1.CacheService.set('onboarding', cacheScope, exams, 3600);
        }
        res.status(200).json({ success: true, data: exams });
    }
    catch (error) {
        console.error('Get Exams Error:', error);
        res.status(500).json({ error: 'Failed to fetch exams' });
    }
});
exports.getExams = getExams;
// ==========================================
// 2. GET EXAM SUBJECTS
// ==========================================
const getExamSubjects = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const examId = req.params.examId;
        if (!examId) {
            return res.status(400).json({ error: 'Exam ID is required.' });
        }
        const cacheScope = `exam_subjects:${examId}`;
        let subjectsData;
        const cachedSubjects = yield cache_service_1.CacheService.get('onboarding', cacheScope);
        if (cachedSubjects) {
            subjectsData = cachedSubjects;
        }
        else {
            const exam = yield db_1.default.exam.findUnique({
                where: { id: examId },
                select: { subjects: true }
            });
            if (!exam) {
                return res.status(404).json({ error: 'Exam not found' });
            }
            subjectsData = exam.subjects;
            yield cache_service_1.CacheService.set('onboarding', cacheScope, subjectsData, 3600);
        }
        res.status(200).json({ success: true, data: subjectsData });
    }
    catch (error) {
        console.error('Get Exam Subjects Error:', error);
        res.status(500).json({ error: 'Failed to fetch subjects for the exam' });
    }
});
exports.getExamSubjects = getExamSubjects;
// ==========================================
// 3. POST SETUP ONBOARDING
// ==========================================
const setupOnboarding = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        // Validate request payload
        const parsedData = onboarding_schema_1.onboardingSetupSchema.parse(req.body);
        // Ensure the target exam exists
        const examExists = yield db_1.default.exam.findUnique({
            where: { id: parsedData.target_exam_id }
        });
        if (!examExists) {
            return res.status(400).json({ error: 'Invalid target exam selected.' });
        }
        // Update user profile
        const updatedUser = yield db_1.default.user.update({
            where: { id: userId },
            data: {
                target_exam_id: parsedData.target_exam_id,
                study_language: parsedData.study_language,
                prep_level: parsedData.prep_level,
                daily_study_hours: parsedData.daily_study_hours || 2
            },
            select: {
                id: true,
                target_exam_id: true,
                study_language: true,
                prep_level: true,
                onboarding_completed: true
            }
        });
        res.status(200).json({
            success: true,
            message: 'Onboarding setup recorded successfully.',
            data: updatedUser
        });
    }
    catch (error) {
        console.error('Setup Onboarding Error:', error);
        if (error.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation Error', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to record onboarding details' });
    }
});
exports.setupOnboarding = setupOnboarding;
// ==========================================
// 4. POST COMPLETE ONBOARDING
// ==========================================
const completeOnboarding = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const updatedUser = yield db_1.default.user.update({
            where: { id: userId },
            data: { onboarding_completed: true },
            select: { id: true, onboarding_completed: true }
        });
        res.status(200).json({
            success: true,
            message: 'Onboarding marked as completed.',
            data: updatedUser
        });
    }
    catch (error) {
        console.error('Complete Onboarding Error:', error);
        res.status(500).json({ error: 'Failed to complete onboarding' });
    }
});
exports.completeOnboarding = completeOnboarding;
// ==========================================
// 5. GET TUTORIAL DATA
// ==========================================
const getTutorialData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Stub response for the UI walk-through
        const tutorialSteps = [
            { id: 1, title: 'Welcome', description: 'Browse and take exams quickly.' },
            { id: 2, title: 'Gamification', description: 'Earn XP, get onto leaderboards.' },
            { id: 3, title: 'AI Insights', description: 'Get actionable feedback on your tests.' }
        ];
        res.status(200).json({
            success: true,
            data: tutorialSteps
        });
    }
    catch (error) {
        console.error('Get Tutorial Data Error:', error);
        res.status(500).json({ error: 'Failed to fetch tutorial data' });
    }
});
exports.getTutorialData = getTutorialData;
