"use strict";
// src/routes/admin/currentAffairs.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_1 = require("../../middlewares/adminAuth");
const currentAffairs_controller_1 = require("../../controllers/admin/currentAffairs.controller");
const router = (0, express_1.Router)();
// Manually trigger an immediate fetch from the GNews API
router.post('/sync', adminAuth_1.requireAdmin, currentAffairs_controller_1.triggerNewsSync);
// Fetch the cached articles from PostgreSQL
router.get('/', adminAuth_1.requireAdmin, currentAffairs_controller_1.getAdminArticles);
// Hide or Pin an article
router.put('/:id/status', adminAuth_1.requireAdmin, currentAffairs_controller_1.updateArticleStatus);
// Create a manual custom article natively
router.post('/custom', adminAuth_1.requireAdmin, currentAffairs_controller_1.createCustomArticle);
// Edit an existing custom article natively
router.put('/:id', adminAuth_1.requireAdmin, currentAffairs_controller_1.editCustomArticle);
// Delete an article entirely
router.delete('/:id', adminAuth_1.requireAdmin, currentAffairs_controller_1.deleteArticle);
exports.default = router;
