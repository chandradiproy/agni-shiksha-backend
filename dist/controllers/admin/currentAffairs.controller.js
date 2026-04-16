"use strict";
// src/controllers/admin/currentAffairs.controller.ts
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
exports.deleteArticle = exports.editCustomArticle = exports.createCustomArticle = exports.updateArticleStatus = exports.getAdminArticles = exports.triggerNewsSync = void 0;
const db_1 = __importDefault(require("../../config/db"));
const newsService_1 = require("../../services/newsService");
const cache_service_1 = require("../../services/cache.service");
const broadcast_1 = require("../../utils/broadcast");
// 1. Manually trigger the news sync
const triggerNewsSync = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const result = yield (0, newsService_1.fetchAndStoreNews)();
        if (!result.success) {
            return res.status(500).json({ error: 'Failed to sync news', details: result.error });
        }
        // Audit Log
        if (adminId) {
            yield db_1.default.adminAuditLog.create({
                data: { admin_id: adminId, action: 'TRIGGERED_NEWS_SYNC', target_id: adminId }
            });
        }
        // 🔴 CRITICAL: Invalidate the Redis cache immediately and push signal to phones!
        yield cache_service_1.CacheService.invalidateTag('articles');
        yield cache_service_1.CacheService.invalidateTag('dashboard_home');
        (0, broadcast_1.broadcastCacheInvalidation)('articles');
        res.status(200).json({ message: 'News sync completed successfully', data: result });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error during sync' });
    }
});
exports.triggerNewsSync = triggerNewsSync;
// 2. Get list of articles for Admin to review
const getAdminArticles = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const [articles, totalCount] = yield Promise.all([
            db_1.default.article.findMany({
                skip,
                take: limit,
                orderBy: { published_at: 'desc' }
            }),
            db_1.default.article.count()
        ]);
        res.status(200).json({
            data: articles,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});
exports.getAdminArticles = getAdminArticles;
// 3. Update article status (Hide or Pin)
const updateArticleStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const { is_hidden, is_pinned } = req.body;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const updatedArticle = yield db_1.default.article.update({
            where: { id: id },
            data: {
                is_hidden: is_hidden !== undefined ? is_hidden : undefined,
                is_pinned: is_pinned !== undefined ? is_pinned : undefined,
                updated_by: adminId // <-- NEW
            }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'UPDATED_ARTICLE_STATUS',
                target_id: updatedArticle.id,
                details: { is_hidden, is_pinned }
            }
        });
        // 🔴 Invalidate cache globally
        yield cache_service_1.CacheService.invalidateTag('articles');
        yield cache_service_1.CacheService.invalidateTag('dashboard_home');
        (0, broadcast_1.broadcastCacheInvalidation)('articles');
        res.status(200).json({ message: 'Article status updated', article: updatedArticle });
    }
    catch (error) {
        console.error('Update Article Status Error:', error);
        res.status(500).json({ error: 'Failed to update article status' });
    }
});
exports.updateArticleStatus = updateArticleStatus;
// 4. Create a Custom Article (Admin Manual Entry)
const createCustomArticle = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { title, summary, content, source_name, image_url, is_pinned } = req.body;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and full content are required for custom articles' });
        }
        const article = yield db_1.default.article.create({
            data: {
                title,
                summary: summary || content.substring(0, 150) + '...', // Auto-generate summary if empty
                content,
                source_name: source_name || 'Agni Shiksha Official',
                source_url: null, // Null safely indicates it is natively hosted inside the app!
                image_url,
                is_custom: true,
                is_pinned: is_pinned || false,
                published_at: new Date(),
                created_by: adminId // <-- NEW
            }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'CREATED_ARTICLE',
                target_id: article.id,
                details: { title }
            }
        });
        // 🔴 Invalidate cache globally
        yield cache_service_1.CacheService.invalidateTag('articles');
        yield cache_service_1.CacheService.invalidateTag('dashboard_home');
        (0, broadcast_1.broadcastCacheInvalidation)('articles');
        res.status(201).json({ message: 'Custom article created successfully', data: article });
    }
    catch (error) {
        console.error('Create Custom Article Error:', error);
        res.status(500).json({ error: 'Failed to create custom article' });
    }
});
exports.createCustomArticle = createCustomArticle;
// 4.5. Edit a Custom Article (Admin Manual Entry Update)
const editCustomArticle = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const { title, summary, content, source_name, image_url, is_pinned } = req.body;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const existingArticle = yield db_1.default.article.findUnique({ where: { id: id } });
        if (!existingArticle) {
            return res.status(404).json({ error: 'Article not found' });
        }
        // Only allow full text edits for custom (manually created) articles to prevent over-writing syncs
        if (!existingArticle.is_custom) {
            return res.status(400).json({ error: 'Cannot edit full content of auto-synced articles natively. Only status updates are permitted.' });
        }
        const updatedArticle = yield db_1.default.article.update({
            where: { id: id },
            data: {
                title: title || existingArticle.title,
                summary: summary !== undefined ? summary : existingArticle.summary,
                content: content || existingArticle.content,
                source_name: source_name || existingArticle.source_name,
                image_url: image_url !== undefined ? image_url : existingArticle.image_url,
                is_pinned: is_pinned !== undefined ? is_pinned : existingArticle.is_pinned,
                updated_by: adminId
            }
        });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'EDITED_ARTICLE',
                target_id: updatedArticle.id,
                details: { title: updatedArticle.title }
            }
        });
        // 🔴 Invalidate cache globally
        yield cache_service_1.CacheService.invalidateTag('articles');
        yield cache_service_1.CacheService.invalidateTag('dashboard_home');
        (0, broadcast_1.broadcastCacheInvalidation)('articles');
        res.status(200).json({ message: 'Custom article updated successfully', data: updatedArticle });
    }
    catch (error) {
        console.error('Edit Custom Article Error:', error);
        res.status(500).json({ error: 'Failed to edit custom article' });
    }
});
exports.editCustomArticle = editCustomArticle;
// 5. Delete an Article (Remove spam or mistakes)
const deleteArticle = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const adminId = (_a = req.admin) === null || _a === void 0 ? void 0 : _a.id;
        const article = yield db_1.default.article.findUnique({ where: { id: id } });
        const article_title = article === null || article === void 0 ? void 0 : article.title;
        const source_url = article === null || article === void 0 ? void 0 : article.source_url;
        yield db_1.default.article.delete({ where: { id: id } });
        // Audit Log
        yield db_1.default.adminAuditLog.create({
            data: {
                admin_id: adminId,
                action: 'DELETED_ARTICLE',
                target_id: id,
                details: { "title": article_title, "url": source_url }
            }
        });
        // 🔴 Invalidate cache globally
        yield cache_service_1.CacheService.invalidateTag('articles');
        yield cache_service_1.CacheService.invalidateTag('dashboard_home');
        (0, broadcast_1.broadcastCacheInvalidation)('articles');
        res.status(200).json({ message: 'Article deleted successfully' });
    }
    catch (error) {
        console.error('Delete Article Error:', error);
        res.status(500).json({ error: 'Failed to delete article' });
    }
});
exports.deleteArticle = deleteArticle;
