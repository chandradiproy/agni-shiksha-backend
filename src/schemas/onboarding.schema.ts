import { z } from 'zod';

export const onboardingSetupSchema = z.object({
  target_exam_id: z.string().uuid("Invalid target exam ID"),
  study_language: z.enum(["hindi", "english"]),
  prep_level: z.enum(["beginner", "intermediate", "advanced"]),
  daily_study_hours: z.number().int().min(1).max(24).optional()
});
