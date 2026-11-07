import { z } from '@/shared/config/openapi.js';
import '@/shared/config/openapi.js';

export const ReportParamsSchema = z
  .object({
    id: z.coerce.number().int().positive().openapi({ example: 1 }),
  })
  .openapi('ReportParams');

export type ReportParams = z.infer<typeof ReportParamsSchema>;
