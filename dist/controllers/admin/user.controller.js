"use strict";
// src/controllers/admin/user.controller.ts
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
exports.toggleForumBan = exports.toggleBanStudent = exports.getAllStudents = void 0;
const db_1 = __importDefault(require("../../config/db"));
// Get all students (with optional search and pagination)
const getAllStudents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;
        // Build the search query
        const whereClause = search ? {
            OR: [
                { id: { equals: search } },
                { full_name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone_number: { contains: search } },
            ]
        } : {};
        const [users, totalCount] = yield Promise.all([
            db_1.default.user.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                // REPLACE 'select' with 'include' to fetch ALL base fields + relations
                include: {
                    target_exam: {
                        select: { id: true, name: true, category: true }
                    },
                    _count: {
                        select: {
                            test_attempts: true,
                            doubts: true,
                            doubt_answers: true,
                            reports_made: true
                        }
                    }
                }
            }),
            db_1.default.user.count({ where: whereClause })
        ]);
        res.status(200).json({
            data: users,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    }
    catch (error) {
        console.error('Get All Students Error:', error);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});
exports.getAllStudents = getAllStudents;
// Toggle Ban Status for a Student
const toggleBanStudent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const { ban_reason } = req.body;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const user = yield db_1.default.user.findUnique({ where: { id: id } });
        if (!user)
            return res.status(404).json({ error: 'Student not found' });
        const newBanStatus = !user.is_banned;
        const updatedUser = yield db_1.default.user.update({
            where: { id: id },
            data: {
                is_banned: newBanStatus,
                ban_reason: newBanStatus ? ban_reason : null, // Clear reason if unbanning
            },
            select: { id: true, is_banned: true, ban_reason: true, email: true }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: newBanStatus ? 'BANNED_USER' : 'UNBANNED_USER',
                target_id: id,
                details: { reason: newBanStatus ? ban_reason : null }
            }
        });
        res.status(200).json({
            message: `Student ${newBanStatus ? 'banned' : 'unbanned'} successfully`,
            user: updatedUser
        });
    }
    catch (error) {
        console.error('Toggle Ban Student Error:', error);
        res.status(500).json({ error: 'Failed to update student ban status' });
    }
});
exports.toggleBanStudent = toggleBanStudent;
// Toggle Forum Access for a Student
const toggleForumBan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { userId } = req.params;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const user = yield db_1.default.user.findUnique({ where: { id: userId } });
        if (!user)
            return res.status(404).json({ error: 'Student not found' });
        const newStatus = !user.forum_banned;
        const updatedUser = yield db_1.default.user.update({
            where: { id: userId },
            data: { forum_banned: newStatus },
            select: { id: true, forum_banned: true, email: true }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: newStatus ? 'FORUM_BANNED_USER' : 'FORUM_UNBANNED_USER',
                target_id: userId
            }
        });
        res.status(200).json({
            message: `Student forum access ${newStatus ? 'revoked' : 'restored'} successfully`,
            user: updatedUser
        });
    }
    catch (error) {
        console.error('Toggle Forum Ban Error:', error);
        res.status(500).json({ error: 'Failed to update student forum access' });
    }
});
exports.toggleForumBan = toggleForumBan;
