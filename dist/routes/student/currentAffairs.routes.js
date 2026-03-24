"use strict";
// src/routes/student/currentAffairs.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const currentAffairs_controller_1 = require("../../controllers/student/currentAffairs.controller");
const router = (0, express_1.Router)();
// Protect routes (or leave public if you want guest access to news)
router.use(auth_1.requireAuth);
// GET /api/v1/student/articles
// Fetches the lightweight paginated news feed
router.get('/', currentAffairs_controller_1.getArticles);
// GET /api/v1/student/articles/:id
// Fetches the full HTML/Markdown body of a specific article
router.get('/:id', currentAffairs_controller_1.getArticleDetails);
exports.default = router;
