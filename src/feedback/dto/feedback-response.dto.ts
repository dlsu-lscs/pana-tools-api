import { z } from '@/shared/config/openapi.js';
import { feedbackCategory } from '../feedback.model.js';

export const FeedbackResponseSchema = z
  .object({
    id: z.string().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
    userId: z.string().nullable().openapi({ example: 'user_123' }),
    email: z.string().nullable().optional().openapi({ example: 'user@example.com' }),
    category: z.enum(feedbackCategory.enumValues).openapi({ example: 'bug' }),
    message: z.string().openapi({ example: 'Found an unexpected issue on the dashboard.' }),
    createdAt: z.coerce.date().openapi({ example: '2026-01-01T00:00:00.000Z' }),
    updatedAt: z.coerce.date().optional().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  })
  .openapi('FeedbackResponse');

export const FeedbackListResponseSchema = z
  .object({
    data: z.array(FeedbackResponseSchema),
    total: z.number().int().nonnegative().openapi({ example: 40 }),
    page: z.number().int().nonnegative().openapi({ example: 1 }),
    limit: z.number().int().nonnegative().openapi({ example: 20 }),
  })
  .openapi('FeedbackListResponse');

export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;
export type FeedbackListResponse = z.infer<typeof FeedbackListResponseSchema>;
