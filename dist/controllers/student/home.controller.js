"use strict";
// src/controllers/student/home.controller.ts
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
exports.getHomeDashboard = void 0;
const db_1 = __importDefault(require("../../config/db"));
const cache_service_1 = require("../../services/cache.service");
const fetchWithVersionedCache = (tag_1, scope_1, ttlSeconds_1, fetcher_1, ...args_1) => __awaiter(void 0, [tag_1, scope_1, ttlSeconds_1, fetcher_1, ...args_1], void 0, function* (tag, scope, ttlSeconds, fetcher, bypassCache = false) {
    try {
        if (!bypassCache) {
            const cached = yield cache_service_1.CacheService.get(tag, scope);
            if (cached !== null)
                return cached;
        }
        const freshData = yield fetcher();
        yield cache_service_1.CacheService.set(tag, scope, freshData, ttlSeconds);
        return freshData;
    }
    catch (err) {
        console.error(`Versioned Cache Error for tag ${tag} scope ${scope}:`, err);
        // Fallback to database if Redis is temporarily down
        return yield fetcher();
    }
});
const getHomeDashboard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const t0 = performance.now();
        const userId = req.user.id;
        const bypassCache = req.headers['x-bypass-cache'] === 'true';
        // 1. Fetch User Data First (Needed for Streak Logic & Recommendations)
        const user = yield db_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                full_name: true,
                avatar_id: true,
                current_streak: true,
                longest_streak: true,
                last_activity_date: true,
                xp_total: true,
                level: true,
                is_premium: true,
                target_exam_id: true,
                target_exam: {
                    select: {
                        name: true,
                        approximate_exam_date: true,
                    }
                }
            }
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        // ==========================================
        // STREAK ENGINE (Auto-Calculates Daily Streak)
        // ==========================================
        const now = new Date();
        // Compare dates safely using simple ISO strings to avoid JS Timezone shifting
        const todayStr = now.toISOString().substring(0, 10);
        const lastDateStr = user.last_activity_date
            ? user.last_activity_date.toISOString().substring(0, 10)
            : null;
        let newStreak = user.current_streak;
        let newLongest = user.longest_streak;
        let needsDbUpdate = false;
        if (!lastDateStr) {
            // First time opening the app!
            newStreak = 1;
            newLongest = 1;
            needsDbUpdate = true;
        }
        else if (todayStr !== lastDateStr) {
            // Day has changed! Calculate difference in days.
            const todayDate = new Date(todayStr); // Local midnight parsing identical strings
            const lastDate = new Date(lastDateStr);
            const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                // Active yesterday UTC! Increment streak.
                newStreak += 1;
                if (newStreak > newLongest)
                    newLongest = newStreak;
            }
            else if (diffDays > 1) {
                // Missed one or more days. Reset to 1.
                newStreak = 1;
            }
            needsDbUpdate = true;
        }
        else if (newStreak === 0) {
            // Failsafe zero-catch
            newStreak = 1;
            needsDbUpdate = true;
        }
        // Fire-and-forget DB update for streak so we don't slow down the API response!
        if (needsDbUpdate) {
            setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    yield db_1.default.user.update({
                        where: { id: userId },
                        data: {
                            current_streak: newStreak,
                            longest_streak: newLongest,
                            last_activity_date: now
                        }
                    });
                }
                catch (e) {
                    console.error('[Streak Update Error]:', e);
                }
            }));
        }
        const t1 = performance.now();
        // ==========================================
        // PARALLEL DATA AGGREGATION (Cached for Instant UI Render)
        // ==========================================
        const [dailyQuizzes, recommendedTests, latestArticles, recentPerformance] = yield Promise.all([
            // A. Cache globally for 1 hour
            fetchWithVersionedCache('tests', 'home:daily_quizzes', 3600, () => 
            // FIXED: Using `testSeries` instead of `test`
            db_1.default.testSeries.findMany({
                where: { test_type: 'DAILY_QUIZ', is_published: true },
                take: 2,
                orderBy: { created_at: 'desc' },
                select: { id: true, title: true, total_marks: true, duration_minutes: true }
            }), bypassCache),
            // B. Cache per exam category for 1 hour
            fetchWithVersionedCache('tests', `home:recommended_tests:${user.target_exam_id || 'all'}`, 3600, () => 
            // FIXED: Using `testSeries` instead of `test`
            db_1.default.testSeries.findMany({
                where: Object.assign({ test_type: 'FULL_MOCK', is_published: true }, (user.target_exam_id ? { exam_id: user.target_exam_id } : {})),
                take: 3,
                orderBy: { created_at: 'desc' },
                // FIXED: Using `type` instead of `is_premium` because schema dictates `type String`
                select: { id: true, title: true, total_marks: true, duration_minutes: true, type: true }
            }), bypassCache),
            // C. Cache globally for 15 minutes (News updates frequently)
            fetchWithVersionedCache('articles', 'home:latest_articles', 900, () => db_1.default.article.findMany({
                where: { is_hidden: false },
                take: 5,
                orderBy: [{ is_pinned: 'desc' }, { published_at: 'desc' }],
                select: { id: true, title: true, category: true, image_url: true, published_at: true }
            }), bypassCache),
            // D. Cache individually per user for 15 minutes
            fetchWithVersionedCache('recent-performance', `home:recent_performance:${userId}`, 900, () => db_1.default.testAttempt.findMany({
                where: { user_id: userId, status: 'completed' }, // Status matches submission worker
                take: 3,
                // FIXED: `end_time` -> `submitted_at`
                orderBy: { submitted_at: 'desc' },
                select: {
                    score: true,
                    // FIXED: `accuracy_percentage` -> `percentage`
                    percentage: true,
                    // FIXED: relation name `test` -> `test_series`
                    test_series: { select: { title: true, total_marks: true } }
                }
            }), bypassCache)
        ]);
        const t2 = performance.now();
        // Send the beautifully aggregated payload to the mobile app
        res.status(200).json({
            success: true,
            debug_timing: {
                userQ: (t1 - t0).toFixed(2) + 'ms',
                dashboardQ: (t2 - t1).toFixed(2) + 'ms',
                total: (t2 - t0).toFixed(2) + 'ms'
            },
            data: {
                user_stats: {
                    full_name: user.full_name,
                    avatar_id: user.avatar_id,
                    current_streak: newStreak, // Send the newly calculated streak instantly
                    xp_total: user.xp_total,
                    level: user.level,
                    is_premium: user.is_premium,
                    target_exam_name: (_b = (_a = user.target_exam) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : null,
                    approximate_exam_date: (_d = (_c = user.target_exam) === null || _c === void 0 ? void 0 : _c.approximate_exam_date) !== null && _d !== void 0 ? _d : null,
                },
                dashboard: {
                    daily_quizzes: dailyQuizzes,
                    recommended_tests: recommendedTests,
                    latest_news: latestArticles,
                    performance_trend: recentPerformance
                }
            }
        });
    }
    catch (error) {
        console.error('Home Dashboard Error:', error);
        res.status(500).json({ error: 'Failed to load home dashboard' });
    }
});
exports.getHomeDashboard = getHomeDashboard;
