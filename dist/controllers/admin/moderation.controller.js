"use strict";
// src/controllers/admin/moderation.controller.ts
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
exports.deleteDoubtAnswer = exports.deleteDoubt = exports.updateDoubtStatus = exports.getModerationDoubts = void 0;
const db_1 = __importDefault(require("../../config/db"));
// 1. Fetch doubts with smart filtering and search
const getModerationDoubts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const filter = req.query.filter; // 'flagged', 'resolved', 'unresolved', or 'all'
        const search = req.query.search;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        // Build dynamic where clause
        let whereClause = {};
        if (filter === 'flagged') {
            whereClause.is_flagged = true;
        }
        else if (filter === 'resolved') {
            whereClause.is_resolved = true;
        }
        else if (filter === 'unresolved') {
            whereClause.is_resolved = false;
        }
        if (search) {
            whereClause.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { subject: { contains: search, mode: 'insensitive' } }
            ];
        }
        const [doubts, totalCount] = yield Promise.all([
            db_1.default.doubt.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: [{ is_flagged: 'desc' }, { created_at: 'desc' }],
                include: {
                    user: { select: { id: true, full_name: true, email: true } },
                    _count: { select: { answers: true } }
                }
            }),
            db_1.default.doubt.count({ where: whereClause })
        ]);
        res.status(200).json({
            data: doubts,
            pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) }
        });
    }
    catch (error) {
        console.error('Fetch Moderation Doubts Error:', error);
        res.status(500).json({ error: 'Failed to fetch doubts for moderation' });
    }
});
exports.getModerationDoubts = getModerationDoubts;
// 2. NEW: Update a Doubt's Status (Mark resolved, or remove a false flag)
const updateDoubtStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { is_flagged, is_resolved } = req.body;
        const adminId = req.admin.id;
        const existingDoubt = yield db_1.default.doubt.findUnique({ where: { id: id } });
        if (!existingDoubt)
            return res.status(404).json({ error: 'Doubt not found' });
        const updatedDoubt = yield db_1.default.doubt.update({
            where: { id: id },
            data: {
                is_flagged: is_flagged !== undefined ? Boolean(is_flagged) : undefined,
                is_resolved: is_resolved !== undefined ? Boolean(is_resolved) : undefined,
            }
        });
        // Record this action in the Admin Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'UPDATED_DOUBT_STATUS',
                target_id: id,
                details: { is_flagged, is_resolved }
            }
        });
        res.status(200).json({ message: 'Doubt status updated successfully', data: updatedDoubt });
    }
    catch (error) {
        console.error('Update Doubt Status Error:', error);
        res.status(500).json({ error: 'Failed to update doubt status' });
    }
});
exports.updateDoubtStatus = updateDoubtStatus;
// 3. Permanently delete an inappropriate doubt (cascading deletes its answers)
const deleteDoubt = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const adminId = req.admin.id;
        const existingDoubt = yield db_1.default.doubt.findUnique({ where: { id: id } });
        if (!existingDoubt)
            return res.status(404).json({ error: 'Doubt not found' });
        yield db_1.default.doubt.delete({ where: { id: id } });
        // Log the deletion
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'DELETED_DOUBT',
                target_id: id,
                details: { doubt_title: existingDoubt.title }
            }
        });
        res.status(200).json({ message: 'Doubt and its associated answers deleted successfully' });
    }
    catch (error) {
        console.error('Delete Doubt Error:', error);
        res.status(500).json({ error: 'Failed to delete doubt' });
    }
});
exports.deleteDoubt = deleteDoubt;
// 4. Permanently delete an inappropriate answer
const deleteDoubtAnswer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const adminId = req.admin.id;
        const existingAnswer = yield db_1.default.doubtAnswer.findUnique({ where: { id: id } });
        if (!existingAnswer)
            return res.status(404).json({ error: 'Answer not found' });
        yield db_1.default.doubtAnswer.delete({ where: { id: id } });
        // Log the deletion
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'DELETED_DOUBT_ANSWER',
                target_id: id,
                details: { answer_preview: existingAnswer.content.substring(0, 50) }
            }
        });
        res.status(200).json({ message: 'Answer deleted successfully' });
    }
    catch (error) {
        console.error('Delete Answer Error:', error);
        res.status(500).json({ error: 'Failed to delete answer' });
    }
});
exports.deleteDoubtAnswer = deleteDoubtAnswer;
