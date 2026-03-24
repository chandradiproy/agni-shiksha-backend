"use strict";
// src/routes/student/social.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const social_controller_1 = require("../../controllers/student/social.controller");
const router = (0, express_1.Router)();
// Secure all social interactions behind auth
router.use(auth_1.requireAuth);
// ------------------------------------------------------------------
// Doubts Feed
// ------------------------------------------------------------------
// Fetch infinite-scroll feed (Supports ?limit=20&cursor=UUID&subject=Math)
router.get('/doubts', social_controller_1.getDoubts);
// Ask a new question
router.post('/doubts', social_controller_1.createDoubt);
// ------------------------------------------------------------------
// Doubt Answers
// ------------------------------------------------------------------
// Fetch all answers for a specific doubt
router.get('/doubts/:doubtId/answers', social_controller_1.getAnswers);
// Post an answer
router.post('/doubts/:doubtId/answers', social_controller_1.postAnswer);
// ------------------------------------------------------------------
// Interactions (Upvotes & Reports)
// ------------------------------------------------------------------
// Toggle an upvote on a doubt OR answer (Body: { "type": "DOUBT" | "ANSWER" })
router.post('/interactions/:targetId/upvote', social_controller_1.toggleUpvote);
// Report a doubt OR answer to the Admin (Body: { "type": "DOUBT" | "ANSWER", "reason": "..." })
router.post('/interactions/:targetId/report', social_controller_1.reportContent);
exports.default = router;
