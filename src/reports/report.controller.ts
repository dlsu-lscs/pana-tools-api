import type { Request, Response } from 'express';
import { logger } from '@/shared/utils/logger.js';
import type { ReportResponse, CheckReportResponse, AdminReportsListResponse } from './dto/index.js';
import {
  CreateReportRequestSchema,
  CheckReportQuerySchema,
  AdminReportsQuerySchema,
  UpdateReportRequestSchema,
  ReportParamsSchema,
  ReportResponseSchema,
  CheckReportResponseSchema,
  AdminReportsListResponseSchema,
} from './dto/index.js';
import type { IReportService } from './report.service.js';

export default class ReportController {
  constructor(private readonly reportService: IReportService) {}

  private getAuthenticatedUserId = (res: Response): string => res.locals.authUserId as string;

  createReport = async (req: Request, res: Response): Promise<void> => {
    const userId = this.getAuthenticatedUserId(res);
    const body = CreateReportRequestSchema.parse(req.body);

    logger.debug('Creating report', { userId, targetType: body.targetType, targetId: body.targetId });

    const created = await this.reportService.createReport(userId, body);

    const response: ReportResponse = created;

    logger.info('Report created successfully', {
      reportId: response.id,
      targetType: response.targetType,
      targetId: response.targetId,
    });

    const validatedResponse = ReportResponseSchema.parse(response);
    res.status(201).json(validatedResponse);
  };

  checkReport = async (req: Request, res: Response): Promise<void> => {
    const userId = this.getAuthenticatedUserId(res);
    const query = CheckReportQuerySchema.parse(req.query);

    logger.debug('Checking report status', { userId, targetType: query.targetType, targetId: query.targetId });

    const result = await this.reportService.checkReport(userId, query.targetType, query.targetId);

    const response: CheckReportResponse = result;

    logger.info('Report check completed', {
      userId,
      hasReported: response.hasReported,
    });

    const validatedResponse = CheckReportResponseSchema.parse(response);
    res.status(200).json(validatedResponse);
  };

  getAdminReports = async (req: Request, res: Response): Promise<void> => {
    const query = AdminReportsQuerySchema.parse(req.query);

    logger.debug('Fetching admin reports', { filters: query });

    const result = await this.reportService.getAdminReports(query);

    const response: AdminReportsListResponse = result;

    logger.info('Admin reports retrieved successfully', {
      total: response.total,
      page: response.page,
    });

    const validatedResponse = AdminReportsListResponseSchema.parse(response);
    res.status(200).json(validatedResponse);
  };

  updateReport = async (req: Request, res: Response): Promise<void> => {
    const adminId = this.getAuthenticatedUserId(res);
    const params = ReportParamsSchema.parse(req.params);
    const body = UpdateReportRequestSchema.parse(req.body);

    logger.debug('Updating report', { reportId: params.id, adminId });

    const updated = await this.reportService.updateReport(params.id, adminId, body);

    const response: ReportResponse = updated;

    logger.info('Report updated successfully', {
      reportId: response.id,
      status: response.status,
    });

    const validatedResponse = ReportResponseSchema.parse(response);
    res.status(200).json(validatedResponse);
  };

  deleteReport = async (req: Request, res: Response): Promise<void> => {
    const params = ReportParamsSchema.parse(req.params);

    logger.debug('Deleting report', { reportId: params.id });

    await this.reportService.deleteReport(params.id);

    logger.info('Report deleted successfully', { reportId: params.id });

    res.status(200).json({ message: 'Report deleted successfully' });
  };
}
