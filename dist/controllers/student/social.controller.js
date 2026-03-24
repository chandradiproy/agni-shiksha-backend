"use strict";
// src/controllers/student/social.controller.ts
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
exports.reportContent = exports.toggleUpvote = exports.postAnswer = exports.getAnswers = exports.createDoubt = exports.getDoubts = void 0;
const db_1 = __importDefault(require("../../config/db"));
const redis_1 = __importDefault(require("../../config/redis"));
// ==========================================
// 1. GET DOUBTS (Cursor-Based Pagination)
// ==========================================
const getDoubts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const cursor = req.query.cursor; // UUID of the last fetched doubt
        const subject = req.query.subject;
        const whereClause = {};
        if (subject)
            whereClause.subject = subject;
        const doubts = yield db_1.default.doubt.findMany(Object.assign(Object.assign({ take: limit }, (cursor ? { skip: 1, cursor: { id: cursor } } : {})), { where: whereClause, orderBy: { created_at: 'desc' }, select: {
                id: true,
                title: true,
                description: true,
                subject: true,
                upvotes: true,
                is_resolved: true,
                created_at: true,
                user: { select: { full_name: true, avatar_id: true } },
                _count: { select: { answers: true } }
            } }));
        const nextCursor = doubts.length === limit ? doubts[doubts.length - 1].id : null;
        res.status(200).json({
            success: true,
            data: doubts,
            pagination: { nextCursor, limit }
        });
    }
    catch (error) {
        console.error('Get Doubts Error:', error);
        res.status(500).json({ error: 'Failed to fetch doubts' });
    }
});
exports.getDoubts = getDoubts;
// ==========================================
// 2. CREATE A DOUBT
// ==========================================
const createDoubt = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { title, description, subject, image_url } = req.body;
        if (!title || !description || !subject) {
            return res.status(400).json({ error: 'Title, description, and subject are required' });
        }
        const doubt = yield db_1.default.doubt.create({
            data: {
                user_id: userId,
                title,
                description,
                subject,
                image_url
            }
        });
        // Fire-and-forget gamification: Reward XP for asking a question
        setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield db_1.default.user.update({
                    where: { id: userId },
                    data: { xp_total: { increment: 10 } }
                });
            }
            catch (e) {
                console.error('Gamification Update Error:', e);
            }
        }));
        res.status(201).json({ success: true, message: 'Doubt posted successfully', data: doubt });
    }
    catch (error) {
        console.error('Create Doubt Error:', error);
        res.status(500).json({ error: 'Failed to create doubt' });
    }
});
exports.createDoubt = createDoubt;
// ==========================================
// 3. GET ANSWERS FOR A DOUBT
// ==========================================
const getAnswers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { doubtId } = req.params;
        const answers = yield db_1.default.doubtAnswer.findMany({
            where: { doubt_id: doubtId },
            orderBy: [{ is_accepted: 'desc' }, { upvotes: 'desc' }, { created_at: 'asc' }],
            select: {
                id: true,
                content: true,
                image_url: true, // Now fully supported by the updated schema
                upvotes: true,
                is_accepted: true,
                created_at: true,
                user: { select: { id: true, full_name: true, avatar_id: true, level: true } }
            }
        });
        res.status(200).json({ success: true, data: answers });
    }
    catch (error) {
        console.error('Get Answers Error:', error);
        res.status(500).json({ error: 'Failed to fetch answers' });
    }
});
exports.getAnswers = getAnswers;
// ==========================================
// 4. POST AN ANSWER
// ==========================================
const postAnswer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { doubtId } = req.params;
        const userId = req.user.id;
        const { content, image_url } = req.body;
        if (!content)
            return res.status(400).json({ error: 'Answer content is required' });
        // Ensure the doubt exists
        const doubtExists = yield db_1.default.doubt.findUnique({ where: { id: doubtId } });
        if (!doubtExists)
            return res.status(404).json({ error: 'Doubt not found' });
        const answer = yield db_1.default.doubtAnswer.create({
            data: {
                doubt_id: doubtId,
                user_id: userId,
                content,
                image_url // Now fully supported by the updated schema
            }
        });
        // Fire-and-forget Gamification: Answer a question (higher XP reward)
        setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield db_1.default.user.update({
                    where: { id: userId },
                    data: { xp_total: { increment: 20 } }
                });
            }
            catch (e) { /* ignore silent failure */ }
        }));
        res.status(201).json({ success: true, message: 'Answer posted successfully', data: answer });
    }
    catch (error) {
        console.error('Post Answer Error:', error);
        res.status(500).json({ error: 'Failed to post answer' });
    }
});
exports.postAnswer = postAnswer;
// ==========================================
// 5. TOGGLE UPVOTE (Doubt or Answer) - Redis Guarded
// ==========================================
const toggleUpvote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { targetId } = req.params;
        const { type } = req.body; // 'DOUBT' or 'ANSWER'
        const userId = req.user.id;
        if (type !== 'DOUBT' && type !== 'ANSWER') {
            return res.status(400).json({ error: 'Invalid upvote type' });
        }
        // SCALABILITY: Use Redis to prevent duplicate votes without a heavy DB Junction Table!
        // We store a key that lives for 30 days to track if this user upvoted this item.
        const redisKey = `upvote:${type}:${targetId}:${userId}`;
        const alreadyVoted = yield redis_1.default.get(redisKey);
        if (alreadyVoted) {
            // User is UN-VOTING (Removing their upvote)
            yield redis_1.default.del(redisKey);
            if (type === 'DOUBT') {
                yield db_1.default.doubt.update({ where: { id: targetId }, data: { upvotes: { decrement: 1 } } });
            }
            else {
                yield db_1.default.doubtAnswer.update({ where: { id: targetId }, data: { upvotes: { decrement: 1 } } });
            }
            return res.status(200).json({ success: true, message: 'Upvote removed', action: 'removed' });
        }
        else {
            // User is UPVOTING (Adding their vote)
            // Cache their vote lock for 30 days (2592000 seconds)
            yield redis_1.default.setEx(redisKey, 2592000, '1');
            if (type === 'DOUBT') {
                yield db_1.default.doubt.update({ where: { id: targetId }, data: { upvotes: { increment: 1 } } });
            }
            else {
                yield db_1.default.doubtAnswer.update({ where: { id: targetId }, data: { upvotes: { increment: 1 } } });
            }
            return res.status(200).json({ success: true, message: 'Upvoted successfully', action: 'added' });
        }
    }
    catch (error) {
        console.error('Toggle Upvote Error:', error);
        res.status(500).json({ error: 'Failed to toggle upvote' });
    }
});
exports.toggleUpvote = toggleUpvote;
// ==========================================
// 6. REPORT CONTENT (To Admin)
// ==========================================
const reportContent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { targetId } = req.params;
        const { type, reason } = req.body; // type: 'DOUBT' or 'ANSWER'
        const userId = req.user.id;
        if (!reason)
            return res.status(400).json({ error: 'Reason is required' });
        yield db_1.default.report.create({
            data: {
                item_id: targetId, // Now correctly aligned with the updated schema
                item_type: type,
                reason: reason,
                reported_by_user_id: userId
            }
        });
        // Also flag the item automatically for Admin review
        if (type === 'DOUBT') {
            yield db_1.default.doubt.update({ where: { id: targetId }, data: { is_flagged: true } });
        }
        else if (type === 'ANSWER') {
            yield db_1.default.doubtAnswer.update({ where: { id: targetId }, data: { is_flagged: true } });
        }
        res.status(200).json({ success: true, message: 'Content reported to administrators' });
    }
    catch (error) {
        console.error('Report Content Error:', error);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});
exports.reportContent = reportContent;
