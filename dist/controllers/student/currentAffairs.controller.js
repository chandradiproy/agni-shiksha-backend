"use strict";
// src/controllers/student/currentAffairs.controller.ts
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
exports.getArticleDetails = exports.getArticles = void 0;
const db_1 = __importDefault(require("../../config/db"));
const cache_service_1 = require("../../services/cache.service");
// ==========================================
// 1. GET PAGINATED NEWS FEED
// ==========================================
const getArticles = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const category = req.query.category; // NEW: Capture the category
        const skip = (page - 1) * limit;
        const whereClause = { is_hidden: false };
        if (category) {
            whereClause.category = { equals: category, mode: 'insensitive' };
        }
        // Update cache key to include category so we don't serve "Sports" news to an "Economy" request
        const cacheScope = `articles_feed:cat:${category || 'all'}:page:${page}:limit:${limit}`;
        if (page === 1) {
            const cachedPage = yield cache_service_1.CacheService.get('articles', cacheScope);
            if (cachedPage) {
                return res.status(200).json(cachedPage);
            }
        }
        const [articles, totalCount] = yield Promise.all([
            db_1.default.article.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: [{ is_pinned: 'desc' }, { published_at: 'desc' }],
                select: {
                    id: true,
                    title: true,
                    summary: true,
                    image_url: true,
                    source_name: true,
                    category: true, // Return category to UI
                    published_at: true,
                    is_pinned: true,
                }
            }),
            db_1.default.article.count({ where: whereClause })
        ]);
        const responseData = {
            success: true,
            data: articles,
            pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) }
        };
        if (page === 1) {
            yield cache_service_1.CacheService.set('articles', cacheScope, responseData, 900);
        }
        res.status(200).json(responseData);
    }
    catch (error) {
        console.error('Get Articles Error:', error);
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});
exports.getArticles = getArticles;
// ==========================================
// 2. GET FULL ARTICLE DETAILS
// ==========================================
const getArticleDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        // Cache individual articles heavily (they are rarely edited after publication)
        const cacheScope = `article_detail:${id}`;
        const cachedArticle = yield cache_service_1.CacheService.get('articles', cacheScope);
        if (cachedArticle) {
            return res.status(200).json({ success: true, data: cachedArticle });
        }
        const article = yield db_1.default.article.findFirst({
            where: { id: id, is_hidden: false }
        });
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        yield cache_service_1.CacheService.set('articles', cacheScope, article, 3600);
        res.status(200).json({
            success: true,
            data: article
        });
    }
    catch (error) {
        console.error('Get Article Details Error:', error);
        res.status(500).json({ error: 'Failed to fetch article details' });
    }
});
exports.getArticleDetails = getArticleDetails;
