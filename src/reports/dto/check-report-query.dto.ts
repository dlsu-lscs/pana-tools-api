import { z } from '@/shared/config/openapi.js';
import '@/shared/config/openapi.js';

export const CheckReportQuerySchema = z
  .object({
    targetType: z.enum(['application', 'review']).openapi({ example: 'application' }),
    targetId: z.coerce.number().int().positive().openapi({ example: 1 }),
  })
  .openapi('CheckReportQuery');

export type CheckReportQuery = z.infer<typeof CheckReportQuerySchema>;
