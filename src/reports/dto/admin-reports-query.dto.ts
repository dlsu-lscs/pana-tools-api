import { z } from '@/shared/config/openapi.js';
import '@/shared/config/openapi.js';

export const AdminReportsQuerySchema = z
  .object({
    status: z.enum(['pending', 'reviewed', 'resolved', 'dismissed']).optional().openapi({ example: 'pending' }),
    targetType: z.enum(['application', 'review']).optional().openapi({ example: 'application' }),
    page: z.coerce.number().int().positive().optional().default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().positive().max(100).optional().default(20).openapi({ example: 20 }),
  })
  .openapi('AdminReportsQuery');

export type AdminReportsQuery = z.infer<typeof AdminReportsQuerySchema>;
