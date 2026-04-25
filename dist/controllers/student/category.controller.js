"use strict";
// src/controllers/student/category.controller.ts
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
exports.getAllCategories = void 0;
const db_1 = __importDefault(require("../../config/db"));
const cache_service_1 = require("../../services/cache.service");
// ==========================================
// 1. GET ALL ACTIVE EXAM CATEGORIES
// ==========================================
const getAllCategories = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cacheScope = 'all_active';
        const cached = yield cache_service_1.CacheService.get('categories', cacheScope);
        if (cached) {
            return res.status(200).json(cached);
        }
        const categories = yield db_1.default.examCategory.findMany({
            where: { is_active: true },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                slug: true,
                icon_url: true,
            },
        });
        const responsePayload = {
            success: true,
            data: categories,
        };
        // Cache for 10 minutes — categories rarely change
        yield cache_service_1.CacheService.set('categories', cacheScope, responsePayload, 600);
        res.status(200).json(responsePayload);
    }
    catch (error) {
        console.error('Get Categories Error:', error);
        res.status(500).json({ error: 'Failed to fetch exam categories' });
    }
});
exports.getAllCategories = getAllCategories;
