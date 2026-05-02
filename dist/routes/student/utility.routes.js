"use strict";
// src/routes/student/utility.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const utility_controller_1 = require("../../controllers/student/utility.controller");
const router = (0, express_1.Router)();
// Protect all utility routes
router.use(auth_1.requireAuth);
// Bookmarks
router.get('/bookmarks', utility_controller_1.getBookmarks);
router.get('/bookmarks/check', utility_controller_1.checkBookmarks);
router.post('/bookmarks/toggle', utility_controller_1.toggleBookmark);
// Notes
router.get('/notes', utility_controller_1.getNotes);
router.post('/notes', utility_controller_1.createNote);
router.put('/notes/:id', utility_controller_1.updateNote);
router.delete('/notes/:id', utility_controller_1.deleteNote);
exports.default = router;
