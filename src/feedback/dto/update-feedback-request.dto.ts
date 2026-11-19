import { z } from '@/shared/config/openapi.js';
import { feedbackCategory, feedbackStatus } from '../feedback.model.js';

export const UpdateFeedbackRequestSchema = z
  .object({
    status: z.enum(feedbackStatus.enumValues).optional().openapi({ example: 'resolved' }),
    category: z.enum(feedbackCategory.enumValues).optional().openapi({ example: 'feature_request' }),
  })
  .refine((body) => body.status !== undefined || body.category !== undefined, {
    message: 'At least one of status or category must be provided',
  })
  .openapi('UpdateFeedbackRequest');

export type UpdateFeedbackRequest = z.infer<typeof UpdateFeedbackRequestSchema>;
