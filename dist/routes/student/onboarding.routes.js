"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const onboarding_controller_1 = require("../../controllers/student/onboarding.controller");
const router = (0, express_1.Router)();
// These routes can be accessed with or without auth, but for user-level onboarding it requires auth.
// Let's protect the setup and complete specifically, while getting exams could be public.
// However, assuming they are within an onboarding flow AFTER registration, requireAuth is fine globally for these.
router.get('/exams', onboarding_controller_1.getExams);
router.get('/tutorial-data', onboarding_controller_1.getTutorialData);
router.get('/subjects/:examId', onboarding_controller_1.getExamSubjects);
// Secured paths
router.post('/setup', auth_1.requireAuth, onboarding_controller_1.setupOnboarding);
router.post('/complete', auth_1.requireAuth, onboarding_controller_1.completeOnboarding);
exports.default = router;
