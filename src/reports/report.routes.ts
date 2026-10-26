import { Router } from 'express';
import { db } from '@/shared/config/database.js';
import { requireAuth, requireRole } from '@/shared/middleware/auth.middleware.js';
import ReportController from './report.controller.js';
import ReportService from './report.service.js';

const router = Router();

const reportService = new ReportService(db);
const reportController = new ReportController(reportService);

/**
 * @route POST /api/reports
 * @description Submit a new report for an application or review
 * @access Private
 */
router.post('/', requireAuth, reportController.createReport);

/**
 * @route GET /api/reports/check
 * @description Check if the current user has already reported a specific target
 * @access Private
 */
router.get('/check', requireAuth, reportController.checkReport);

/**
 * @route GET /api/reports/admin
 * @description List all reports with optional filters (Admin only)
 * @access Private (Admin only)
 */
router.get('/admin', requireAuth, requireRole('admin'), reportController.getAdminReports);

/**
 * @route PATCH /api/reports/admin/:id
 * @description Update a report status and admin note (Admin only)
 * @access Private (Admin only)
 */
router.patch('/admin/:id', requireAuth, requireRole('admin'), reportController.updateReport);

/**
 * @route DELETE /api/reports/admin/:id
 * @description Delete a report (Admin only)
 * @access Private (Admin only)
 */
router.delete('/admin/:id', requireAuth, requireRole('admin'), reportController.deleteReport);

export default router;
