"use strict";
// src/routes/admin/dashboard.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_1 = require("../../middlewares/adminAuth");
const dashboard_controller_1 = require("../../controllers/admin/dashboard.controller");
const router = (0, express_1.Router)();
router.get('/stats', adminAuth_1.requireAdmin, dashboard_controller_1.getDashboardStats);
exports.default = router;
