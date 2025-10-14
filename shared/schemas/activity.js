import { z } from 'zod';

export const MCQOptionsSchema = z
  .union([z.array(z.string()), z.object({ choices: z.array(z.string()) })])
  .transform((v) => (Array.isArray(v) ? v : v.choices));

export const CreateActivitySchema = z.object({
  title: z.string().optional().nullable(),
  question: z.string().min(1),
  type: z.enum(['MCQ', 'SHORT_TEXT']).default('MCQ'),
  options: MCQOptionsSchema.nullish().transform((v) => v ?? null),
  answer: z.any().optional(),
  hints: z.array(z.string()).default([]),
  instructionsMd: z.string().optional(),
  promptTemplateId: z.number().int().nullable().optional(),
  mainTopicId: z.number().int(),
  secondaryTopicIds: z.array(z.number().int()).default([]),
});

export const UpdateActivitySchema = z.object({
  promptTemplateId: z.number().int().nullable().optional(),
  mainTopicId: z.number().int().optional(),
  secondaryTopicIds: z.array(z.number().int()).optional(),
});

export default {
  MCQOptionsSchema,
  CreateActivitySchema,
  UpdateActivitySchema,
};
