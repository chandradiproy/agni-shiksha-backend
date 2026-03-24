"use strict";
// src/controllers/student/gamification.controller.ts
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
exports.getGamificationProfile = exports.getLeaderboard = void 0;
const db_1 = __importDefault(require("../../config/db"));
const redis_1 = __importDefault(require("../../config/redis"));
// ==========================================
// 1. GET LEADERBOARD (Highly Scalable)
// ==========================================
const getLeaderboard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cacheKey = 'global_leaderboard_top_100';
        // 1. Try to serve from memory instantly
        const cachedLeaderboard = yield redis_1.default.get(cacheKey);
        if (cachedLeaderboard) {
            return res.status(200).json({ success: true, data: JSON.parse(cachedLeaderboard) });
        }
        // 2. If cache expires, query the DB
        const topUsers = yield db_1.default.user.findMany({
            where: { is_banned: false },
            take: 100,
            orderBy: { xp_total: 'desc' },
            select: {
                id: true,
                full_name: true,
                avatar_id: true,
                level: true,
                xp_total: true,
            }
        });
        // 3. Cache the result for 5 minutes
        // This protects the database! If 10,000 users check the leaderboard, 
        // it only hits the database ONCE every 5 minutes.
        yield redis_1.default.setEx(cacheKey, 300, JSON.stringify(topUsers));
        res.status(200).json({
            success: true,
            data: topUsers
        });
    }
    catch (error) {
        console.error('Get Leaderboard Error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});
exports.getLeaderboard = getLeaderboard;
// ==========================================
// 2. GET MY GAMIFICATION STATS & BADGES
// ==========================================
const getGamificationProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const [user, allBadges] = yield Promise.all([
            db_1.default.user.findUnique({
                where: { id: userId },
                select: { xp_total: true, level: true, gems: true, current_streak: true, longest_streak: true }
            }),
            db_1.default.badgeConfig.findMany({
                orderBy: { unlock_xp_threshold: 'asc' }
            })
        ]);
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        // Determine which badges the user has unlocked based on their XP
        const badges = allBadges.map(badge => (Object.assign(Object.assign({}, badge), { is_unlocked: user.xp_total >= badge.unlock_xp_threshold })));
        res.status(200).json({
            success: true,
            data: {
                stats: user,
                badges: badges
            }
        });
    }
    catch (error) {
        console.error('Get Gamification Profile Error:', error);
        res.status(500).json({ error: 'Failed to fetch gamification profile' });
    }
});
exports.getGamificationProfile = getGamificationProfile;
