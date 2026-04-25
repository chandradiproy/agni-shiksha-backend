"use strict";
// src/controllers/admin/category.controller.ts
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
exports.deleteCategory = exports.updateCategory = exports.getAllCategories = exports.createCategory = void 0;
const db_1 = __importDefault(require("../../config/db"));
const cache_service_1 = require("../../services/cache.service");
// ==========================================
// 1. CREATE CATEGORY
// ==========================================
const createCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, slug, icon_url } = req.body;
        if (!name || !slug) {
            return res.status(400).json({ error: 'name and slug are required' });
        }
        const existing = yield db_1.default.examCategory.findFirst({
            where: { OR: [{ name }, { slug }] },
        });
        if (existing) {
            return res.status(409).json({ error: 'A category with this name or slug already exists' });
        }
        const category = yield db_1.default.examCategory.create({
            data: { name, slug, icon_url: icon_url || null },
        });
        // Invalidate student-facing category cache
        yield cache_service_1.CacheService.invalidateTag('categories');
        res.status(201).json({ success: true, data: category });
    }
    catch (error) {
        console.error('Create Category Error:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});
exports.createCategory = createCategory;
// ==========================================
// 2. GET ALL CATEGORIES (Admin — includes inactive)
// ==========================================
const getAllCategories = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const categories = yield db_1.default.examCategory.findMany({
            orderBy: { created_at: 'desc' },
            include: {
                _count: { select: { test_series: true } },
            },
        });
        res.status(200).json({ success: true, data: categories });
    }
    catch (error) {
        console.error('Get All Categories Error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});
exports.getAllCategories = getAllCategories;
// ==========================================
// 3. UPDATE CATEGORY
// ==========================================
const updateCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const { name, slug, icon_url, is_active } = req.body;
        const category = yield db_1.default.examCategory.findUnique({ where: { id } });
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        const updated = yield db_1.default.examCategory.update({
            where: { id },
            data: Object.assign(Object.assign(Object.assign(Object.assign({}, (name !== undefined && { name })), (slug !== undefined && { slug })), (icon_url !== undefined && { icon_url })), (is_active !== undefined && { is_active })),
        });
        yield cache_service_1.CacheService.invalidateTag('categories');
        res.status(200).json({ success: true, data: updated });
    }
    catch (error) {
        console.error('Update Category Error:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});
exports.updateCategory = updateCategory;
// ==========================================
// 4. DELETE CATEGORY
// ==========================================
const deleteCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const category = yield db_1.default.examCategory.findUnique({
            where: { id },
            include: { _count: { select: { test_series: true } } },
        });
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        if (category._count.test_series > 0) {
            return res.status(400).json({
                error: `Cannot delete category "${category.name}" because it has ${category._count.test_series} test series assigned. Reassign or remove them first.`,
            });
        }
        yield db_1.default.examCategory.delete({ where: { id } });
        yield cache_service_1.CacheService.invalidateTag('categories');
        res.status(200).json({ success: true, message: 'Category deleted successfully' });
    }
    catch (error) {
        console.error('Delete Category Error:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});
exports.deleteCategory = deleteCategory;
