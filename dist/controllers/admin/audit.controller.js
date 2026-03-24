"use strict";
// src/controllers/admin/audit.controller.ts
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
exports.getAuditLogs = void 0;
const db_1 = __importDefault(require("../../config/db"));
const getAuditLogs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        // Optional filters for the frontend
        const adminId = req.query.adminId;
        const action = req.query.action;
        const whereClause = {};
        if (adminId)
            whereClause.admin_id = adminId;
        if (action)
            whereClause.action = action;
        const [logs, totalCount] = yield Promise.all([
            db_1.default.adminAuditLog.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    admin: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                }
            }),
            db_1.default.adminAuditLog.count({ where: whereClause })
        ]);
        res.status(200).json({
            data: logs,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    }
    catch (error) {
        console.error('Fetch Audit Logs Error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});
exports.getAuditLogs = getAuditLogs;
