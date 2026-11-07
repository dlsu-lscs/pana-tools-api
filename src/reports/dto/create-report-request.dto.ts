import { z } from '@/shared/config/openapi.js';
import '@/shared/config/openapi.js';

export const CreateReportRequestSchema = z
  .object({
    targetType: z.enum(['application', 'review']).openapi({ example: 'application' }),
    targetId: z.coerce.number().int().positive().openapi({ example: 1 }),
    reason: z
      .enum(['spam', 'inappropriate', 'misleading', 'offensive', 'other'])
      .openapi({ example: 'spam' }),
    description: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .optional()
      .nullable()
      .openapi({ example: 'This application contains misleading information.' }),
  })
  .openapi('CreateReportRequest');

export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>;
