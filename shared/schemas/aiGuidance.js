import { z } from 'zod';

export const KnowledgeLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);

export const TeachRequestSchema = z.object({
  knowledgeLevel: KnowledgeLevelSchema,
  topicId: z.number().int().optional(),
  message: z.string().min(1),
  modelId: z.string().min(1),
});

export const GuideRequestSchema = z.object({
  knowledgeLevel: KnowledgeLevelSchema,
  message: z.string().min(1),
  studentAnswer: z.union([z.string(), z.number()]).nullish(),
  modelId: z.string().min(1),
});

export default {
  KnowledgeLevelSchema,
  TeachRequestSchema,
  GuideRequestSchema,
};
