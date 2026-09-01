import { z } from '@/shared/config/openapi.js';
import '@/shared/config/openapi.js';

export const ReportResponseSchema = z
  .object({
    id: z.coerce.number().int().positive().openapi({ example: 1 }),
    reporterId: z.string().openapi({ example: 'user_123' }),
    targetType: z.enum(['application', 'review']).openapi({ example: 'application' }),
    targetId: z.coerce.number().int().positive().openapi({ example: 42 }),
    reason: z
      .enum(['spam', 'inappropriate', 'misleading', 'offensive', 'other'])
      .openapi({ example: 'spam' }),
    description: z.string().nullable().openapi({ example: 'Contains misleading info.' }),
    status: z
      .enum(['pending', 'reviewed', 'resolved', 'dismissed'])
      .openapi({ example: 'pending' }),
    adminNote: z.string().nullable().openapi({ example: null }),
    reviewedBy: z.string().nullable().openapi({ example: null }),
    createdAt: z.coerce.date().openapi({ example: '2026-01-01T00:00:00.000Z' }),
    updatedAt: z.coerce.date().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  })
  .openapi('ReportResponse');

export const ReportSummarySchema = z
  .object({
    id: z.coerce.number().int().positive().openapi({ example: 1 }),
    targetType: z.enum(['application', 'review']).openapi({ example: 'application' }),
    targetId: z.coerce.number().int().positive().openapi({ example: 42 }),
    reason: z
      .enum(['spam', 'inappropriate', 'misleading', 'offensive', 'other'])
      .openapi({ example: 'spam' }),
    status: z
      .enum(['pending', 'reviewed', 'resolved', 'dismissed'])
      .openapi({ example: 'pending' }),
    createdAt: z.coerce.date().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  })
  .openapi('ReportSummary');

export const CheckReportResponseSchema = z
  .object({
    hasReported: z.boolean().openapi({ example: false }),
    report: ReportSummarySchema.optional().nullable().openapi({ example: null }),
  })
  .openapi('CheckReportResponse');

export const AdminReportItemSchema = z
  .object({
    id: z.coerce.number().int().positive().openapi({ example: 1 }),
    reporterId: z.string().openapi({ example: 'user_123' }),
    reporterEmail: z.string().nullable().openapi({ example: 'reporter@example.com' }),
    reporterName: z.string().nullable().openapi({ example: 'John Doe' }),
    targetType: z.enum(['application', 'review']).openapi({ example: 'application' }),
    targetId: z.coerce.number().int().positive().openapi({ example: 42 }),
    reason: z
      .enum(['spam', 'inappropriate', 'misleading', 'offensive', 'other'])
      .openapi({ example: 'spam' }),
    description: z.string().nullable().openapi({ example: 'Contains misleading info.' }),
    status: z
      .enum(['pending', 'reviewed', 'resolved', 'dismissed'])
      .openapi({ example: 'pending' }),
    adminNote: z.string().nullable().openapi({ example: null }),
    reviewedBy: z.string().nullable().openapi({ example: null }),
    createdAt: z.coerce.date().openapi({ example: '2026-01-01T00:00:00.000Z' }),
    updatedAt: z.coerce.date().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  })
  .openapi('AdminReportItem');

export const AdminReportsListResponseSchema = z
  .object({
    reports: z.array(AdminReportItemSchema),
    total: z.coerce.number().int().nonnegative().openapi({ example: 5 }),
    page: z.coerce.number().int().positive().openapi({ example: 1 }),
    limit: z.coerce.number().int().positive().openapi({ example: 20 }),
  })
  .openapi('AdminReportsListResponse');

export type ReportResponse = z.infer<typeof ReportResponseSchema>;
export type ReportSummary = z.infer<typeof ReportSummarySchema>;
export type CheckReportResponse = z.infer<typeof CheckReportResponseSchema>;
export type AdminReportItem = z.infer<typeof AdminReportItemSchema>;
export type AdminReportsListResponse = z.infer<typeof AdminReportsListResponseSchema>;
