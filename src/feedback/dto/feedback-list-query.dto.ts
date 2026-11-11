import { z } from '@/shared/config/openapi.js';
import { feedbackCategory, feedbackSortOptions } from '../feedback.model.js';

export const FeedbackListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().positive().max(100).optional().default(20).openapi({ example: 20 }),
    category: z.enum(feedbackCategory.enumValues).optional().openapi({ example: 'bug' }),
    search: z.string().trim().optional().openapi({ example: 'login issue' }),
    userId: z.string().optional().openapi({ description: 'optional id from users table' }),
    sortBy: z.enum(feedbackSortOptions.enumValues).optional().default('createdAt').openapi({ example: 'createdAt' }),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc').openapi({ example: 'desc' }),
  })
  .openapi('FeedbackListQuery');

export type FeedbackListQuery = z.infer<typeof FeedbackListQuerySchema>;
export type FeedbackListInput = z.input<typeof FeedbackListQuerySchema>;
