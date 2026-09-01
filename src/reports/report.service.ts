import { and, eq, count } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { HttpError } from '@/shared/middleware/error.middleware.js';
import {
  ReportResponseSchema,
  CheckReportResponseSchema,
  AdminReportsListResponseSchema,
  AdminReportItemSchema,
  type ReportResponse,
  type CheckReportResponse,
  type AdminReportsListResponse,
} from './dto/index.js';
import type { CreateReportRequest, AdminReportsQuery, UpdateReportRequest } from './dto/index.js';
import { application, rating, report, user, type SelectReport } from './report.model.js';

export interface IReportService {
  createReport(reporterId: string, payload: CreateReportRequest): Promise<ReportResponse>;
  checkReport(
    reporterId: string,
    targetType: 'application' | 'review',
    targetId: number,
  ): Promise<CheckReportResponse>;
  getAdminReports(filters: AdminReportsQuery): Promise<AdminReportsListResponse>;
  updateReport(
    id: number,
    adminId: string,
    payload: UpdateReportRequest,
  ): Promise<ReportResponse>;
  deleteReport(id: number): Promise<void>;
}

export default class ReportService implements IReportService {
  constructor(private readonly db: NodePgDatabase) {}

  private getReportById = async (id: number): Promise<SelectReport> => {
    const [found] = await this.db
      .select()
      .from(report)
      .where(eq(report.id, id))
      .limit(1);

    if (!found) {
      throw new HttpError(404, 'Report not found', 'NOT_FOUND');
    }

    return found;
  };

  private validateTargetExists = async (
    targetType: 'application' | 'review',
    targetId: number,
  ): Promise<{ ownerId: string }> => {
    if (targetType === 'application') {
      const [app] = await this.db
        .select({ id: application.id, userId: application.userId })
        .from(application)
        .where(eq(application.id, targetId))
        .limit(1);

      if (!app) {
        throw new HttpError(404, 'Application not found', 'NOT_FOUND');
      }

      return { ownerId: app.userId };
    }

    // targetType === 'review'
    const [ratingRow] = await this.db
      .select({ id: rating.id, userId: rating.userId })
      .from(rating)
      .where(eq(rating.id, targetId))
      .limit(1);

    if (!ratingRow) {
      throw new HttpError(404, 'Review not found', 'NOT_FOUND');
    }

    return { ownerId: ratingRow.userId };
  };

  createReport = async (
    reporterId: string,
    payload: CreateReportRequest,
  ): Promise<ReportResponse> => {
    const { targetType, targetId, reason, description } = payload;

    // Validate target exists and get the owner
    const { ownerId } = await this.validateTargetExists(targetType, targetId);

    // Cannot report own content
    if (reporterId === ownerId) {
      throw new HttpError(403, 'You cannot report your own content', 'FORBIDDEN');
    }

    // Check for duplicate
    const [existing] = await this.db
      .select({ id: report.id })
      .from(report)
      .where(
        and(
          eq(report.reporterId, reporterId),
          eq(report.targetType, targetType),
          eq(report.targetId, targetId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new HttpError(409, 'You have already reported this content', 'DUPLICATE_REPORT');
    }

    const [created] = await this.db
      .insert(report)
      .values({
        reporterId,
        targetType,
        targetId,
        reason,
        description: description ?? null,
      })
      .returning();

    return ReportResponseSchema.parse(created);
  };

  checkReport = async (
    reporterId: string,
    targetType: 'application' | 'review',
    targetId: number,
  ): Promise<CheckReportResponse> => {
    const [existing] = await this.db
      .select({
        id: report.id,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
      })
      .from(report)
      .where(
        and(
          eq(report.reporterId, reporterId),
          eq(report.targetType, targetType),
          eq(report.targetId, targetId),
        ),
      )
      .limit(1);

    if (existing) {
      return CheckReportResponseSchema.parse({
        hasReported: true,
        report: existing,
      });
    }

    return CheckReportResponseSchema.parse({
      hasReported: false,
      report: null,
    });
  };

  getAdminReports = async (
    filters: AdminReportsQuery,
  ): Promise<AdminReportsListResponse> => {
    const { status, targetType, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (status) {
      conditions.push(eq(report.status, status));
    }

    if (targetType) {
      conditions.push(eq(report.targetType, targetType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [reportRows, countRows] = await Promise.all([
      this.db
        .select({
          id: report.id,
          reporterId: report.reporterId,
          reporterEmail: user.email,
          reporterName: user.name,
          targetType: report.targetType,
          targetId: report.targetId,
          reason: report.reason,
          description: report.description,
          status: report.status,
          adminNote: report.adminNote,
          reviewedBy: report.reviewedBy,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
        })
        .from(report)
        .innerJoin(user, eq(report.reporterId, user.id))
        .where(whereClause)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(report)
        .where(whereClause),
    ]);

    const total = countRows[0]?.total ?? 0;

    return AdminReportsListResponseSchema.parse({
      reports: reportRows.map((row) => AdminReportItemSchema.parse(row)),
      total,
      page,
      limit,
    });
  };

  updateReport = async (
    id: number,
    adminId: string,
    payload: UpdateReportRequest,
  ): Promise<ReportResponse> => {
    // Verify report exists
    await this.getReportById(id);

    const [updated] = await this.db
      .update(report)
      .set({
        status: payload.status,
        adminNote: payload.adminNote ?? null,
        reviewedBy: adminId,
        updatedAt: new Date(),
      })
      .where(eq(report.id, id))
      .returning();

    if (!updated) {
      throw new HttpError(404, 'Report not found', 'NOT_FOUND');
    }

    return ReportResponseSchema.parse(updated);
  };

  deleteReport = async (id: number): Promise<void> => {
    // Verify report exists
    await this.getReportById(id);

    await this.db.delete(report).where(eq(report.id, id));
  };
}
