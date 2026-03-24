"use strict";
// src/routes/admin/plan.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_1 = require("../../middlewares/adminAuth");
const plan_controller_1 = require("../../controllers/admin/plan.controller");
const router = (0, express_1.Router)();
// Protect all plan management routes
router.use(adminAuth_1.requireAdmin);
// ------------------------------------------------------------------
// Premium Subscription Plans Management
// ------------------------------------------------------------------
router.post('/', plan_controller_1.createPlan);
router.get('/', plan_controller_1.getAllPlans);
router.put('/:id', plan_controller_1.updatePlan);
router.delete('/:id', plan_controller_1.deletePlan);
exports.default = router;
