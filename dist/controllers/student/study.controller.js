"use strict";
// src/controllers/student/study.controller.ts
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
exports.getStudyMaterials = exports.getStudyPlans = void 0;
const db_1 = __importDefault(require("../../config/db"));
const cache_service_1 = require("../../services/cache.service");
// ==========================================
// 1. GET STUDY PLANS (Day-by-Day Syllabus)
// ==========================================
const getStudyPlans = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        // Fallback to the user's default exam if they don't explicitly filter
        const user = yield db_1.default.user.findUnique({ where: { id: userId }, select: { target_exam_id: true } });
        const examId = req.query.examId || (user === null || user === void 0 ? void 0 : user.target_exam_id);
        if (!examId) {
            return res.status(400).json({ error: 'Please select a target exam to view study plans.' });
        }
        // Cache the study plan structure per exam (Cached for 1 hour)
        const cacheScope = `study_plans:exam:${examId}`;
        let plans;
        const cachedPlans = yield cache_service_1.CacheService.get('study', cacheScope);
        if (cachedPlans) {
            plans = cachedPlans;
        }
        else {
            plans = yield db_1.default.studyPlan.findMany({
                where: { exam_id: examId },
                include: {
                    tasks: {
                        orderBy: { day_number: 'asc' }
                    }
                },
                orderBy: { created_at: 'desc' }
            });
            yield cache_service_1.CacheService.set('study', cacheScope, plans, 3600);
        }
        res.status(200).json({
            success: true,
            data: plans
        });
    }
    catch (error) {
        console.error('Get Study Plans Error:', error);
        res.status(500).json({ error: 'Failed to fetch study plans' });
    }
});
exports.getStudyPlans = getStudyPlans;
// ==========================================
// 2. GET STUDY MATERIALS (PDFs/Videos with Soft-Gate)
// ==========================================
const getStudyMaterials = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const subject = req.query.subject;
        // 1. Fetch user to check their premium status and default exam
        const user = yield db_1.default.user.findUnique({
            where: { id: userId },
            select: { target_exam_id: true, is_premium: true }
        });
        const examId = req.query.examId || (user === null || user === void 0 ? void 0 : user.target_exam_id);
        if (!examId) {
            return res.status(400).json({ error: 'Please select a target exam.' });
        }
        // 2. Fetch Base Materials from Redis Cache (Shared globally across all students for this exam)
        // We cache the raw database records for 1 hour
        const cacheScope = `study_materials:exam:${examId}:subject:${subject || 'all'}`;
        let materials;
        const cachedMaterials = yield cache_service_1.CacheService.get('study', cacheScope);
        if (cachedMaterials) {
            materials = cachedMaterials;
        }
        else {
            const whereClause = { exam_id: examId, is_active: true };
            if (subject)
                whereClause.subject = subject;
            materials = yield db_1.default.studyMaterial.findMany({
                where: whereClause,
                orderBy: [{ is_premium: 'desc' }, { created_at: 'desc' }]
            });
            yield cache_service_1.CacheService.set('study', cacheScope, materials, 3600);
        }
        // 3. SECURITY GATE: Apply Premium Paywall Logic IN-MEMORY
        // We strip the file_url for free users accessing premium content
        const secureMaterials = materials.map((material) => {
            const isLocked = material.is_premium && !(user === null || user === void 0 ? void 0 : user.is_premium);
            return Object.assign(Object.assign({}, material), { file_url: isLocked ? null : material.file_url, is_locked: isLocked // Frontend uses this boolean to show the "Crown" icon and trigger Razorpay
             });
        });
        res.status(200).json({
            success: true,
            data: secureMaterials
        });
    }
    catch (error) {
        console.error('Get Study Materials Error:', error);
        res.status(500).json({ error: 'Failed to fetch study materials' });
    }
});
exports.getStudyMaterials = getStudyMaterials;
