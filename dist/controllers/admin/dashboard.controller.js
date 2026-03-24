"use strict";
// src/controllers/admin/dashboard.controller.ts
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
exports.getDashboardStats = void 0;
const db_1 = __importDefault(require("../../config/db"));
const getDashboardStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Run all count queries concurrently for maximum speed
        const [totalStudents, activeTests, totalQuestions, totalAdmins] = yield Promise.all([
            db_1.default.user.count(),
            db_1.default.testSeries.count({ where: { is_active: true } }),
            db_1.default.question.count(),
            db_1.default.adminUser.count({ where: { is_active: true } })
        ]);
        // Get recent signups for a quick snapshot table
        const recentStudents = yield db_1.default.user.findMany({
            take: 5,
            orderBy: { created_at: 'desc' },
            select: {
                id: true,
                full_name: true,
                email: true,
                phone_number: true,
                created_at: true
            }
        });
        res.status(200).json({
            metrics: {
                totalStudents,
                activeTests,
                totalQuestions,
                totalAdmins
            },
            recentStudents
        });
    }
    catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
    }
});
exports.getDashboardStats = getDashboardStats;
