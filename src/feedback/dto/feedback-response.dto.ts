import { z } from '@/shared/config/openapi.js';
import { feedbackCategory, feedbackStatus } from '../feedback.model.js';

export const FeedbackResponseSchema = z
  .object({
    id: z.string().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
    userId: z.string().nullable().openapi({ example: 'user_123' }),
    email: z.string().nullable().optional().openapi({ example: 'user@example.com' }),
    category: z.enum(feedbackCategory.enumValues).openapi({ example: 'bug' }),
    status: z.enum(feedbackStatus.enumValues).openapi({ example: 'unresolved' }),
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
    statusCounts: z
      .object({
        unresolved: z.number().int().nonnegative(),
        pending: z.number().int().nonnegative(),
        resolved: z.number().int().nonnegative(),
      })
      .openapi({
        description: 'Counts per status across all pages, honoring every filter except `status`',
        example: { unresolved: 12, pending: 3, resolved: 25 },
      }),
  })
  .openapi('FeedbackListResponse');

export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;
export type FeedbackListResponse = z.infer<typeof FeedbackListResponseSchema>;
