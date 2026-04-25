"use strict";
// src/routes/admin/category.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_1 = require("../../middlewares/adminAuth");
const category_controller_1 = require("../../controllers/admin/category.controller");
const router = (0, express_1.Router)();
// ==========================================
// EXAM CATEGORY ROUTES (Admin CRUD)
// ==========================================
router.post('/', adminAuth_1.requireAdmin, category_controller_1.createCategory);
router.get('/', adminAuth_1.requireAdmin, category_controller_1.getAllCategories);
router.put('/:id', adminAuth_1.requireAdmin, category_controller_1.updateCategory);
router.delete('/:id', adminAuth_1.requireAdmin, category_controller_1.deleteCategory);
exports.default = router;
