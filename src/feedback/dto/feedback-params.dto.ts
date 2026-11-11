import { z } from '@/shared/config/openapi.js';

export const FeedbackParamsSchema = z
  .object({
    id: z.string().min(1).openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  })
  .openapi('FeedbackParams');

export type FeedbackParams = z.infer<typeof FeedbackParamsSchema>;
