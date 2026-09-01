import { z } from '@/shared/config/openapi.js';
import '@/shared/config/openapi.js';

export const UpdateReportRequestSchema = z
  .object({
    status: z
      .enum(['pending', 'reviewed', 'resolved', 'dismissed'])
      .openapi({ example: 'resolved' }),
    adminNote: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .optional()
      .nullable()
      .openapi({ example: 'Reviewed and confirmed spam content.' }),
  })
  .openapi('UpdateReportRequest');

export type UpdateReportRequest = z.infer<typeof UpdateReportRequestSchema>;
