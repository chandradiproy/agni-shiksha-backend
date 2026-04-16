"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onboardingSetupSchema = void 0;
const zod_1 = require("zod");
exports.onboardingSetupSchema = zod_1.z.object({
    target_exam_id: zod_1.z.string().uuid("Invalid target exam ID"),
    study_language: zod_1.z.enum(["hindi", "english"]),
    prep_level: zod_1.z.enum(["beginner", "intermediate", "advanced"]),
    daily_study_hours: zod_1.z.number().int().min(1).max(24).optional()
});
