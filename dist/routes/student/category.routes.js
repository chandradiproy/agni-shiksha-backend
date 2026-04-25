"use strict";
// src/routes/student/category.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const category_controller_1 = require("../../controllers/student/category.controller");
const router = (0, express_1.Router)();
// Protect all category routes
router.use(auth_1.requireAuth);
// 1. List all active exam categories (for filter chips in ExamListScreen)
router.get('/', category_controller_1.getAllCategories);
exports.default = router;
