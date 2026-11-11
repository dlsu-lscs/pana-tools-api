import { z } from '@/shared/config/openapi.js';
import { feedbackCategory } from '../feedback.model.js';

export const CreateFeedbackRequestSchema = z
  .object({
    category: z.enum(feedbackCategory.enumValues).openapi({ example: 'bug' }),
    message: z.string().min(10).max(1000).openapi({ example: 'Found an unexpected issue on the dashboard.' }),
    email: z.string().email().optional().nullable().openapi({ example: 'user@example.com' }),
  })
  .openapi('CreateFeedbackRequest');

export type CreateFeedbackRequest = z.infer<typeof CreateFeedbackRequestSchema>;
