"use strict";
// src/routes/admin/audit.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const audit_controller_1 = require("../../controllers/admin/audit.controller");
const adminAuth_1 = require("../../middlewares/adminAuth");
const router = (0, express_1.Router)();
// Secure all routes with the admin authentication middleware
router.use(adminAuth_1.requireAdmin);
// Secure all routes with the admin authentication middleware
router.use((0, adminAuth_1.requireRole)(['admin', 'super-admin', 'super_admin']));
// Get paginated audit logs
router.get('/', audit_controller_1.getAuditLogs);
exports.default = router;
