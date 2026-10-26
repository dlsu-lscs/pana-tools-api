import { Router } from 'express';
import { ApplicationController } from './application.controller.js';
import ApplicationService from '@/applications/application.service.js';
import { requireAuth, requireRole } from '@/shared/middleware/auth.middleware.js';
import { rateLimitViewIncrement } from '@/shared/middleware/rate-limit.middleware.js';
import { db } from '@/shared/config/database.js';

const router = Router();

const applicationService = new ApplicationService(db);
const applicationController = new ApplicationController(applicationService);

/**
 * @route GET /api/applications
 * @description List applications with optional filters, pagination, and sorting
 * @access Public
 */
router.get('/', applicationController.getPaginatedApplications);

/**
 * @route POST /api/applications
 * @description Create an application
 * @access Private
 */
router.post('/', requireAuth, applicationController.createApplication);

/**
 * @route PATCH /api/applications/:id
 * @description Update an application by ID
 * @access Private
 */
router.patch('/:id', requireAuth, applicationController.patchApplicationById);

/**
 * @route DELETE /api/applications/admin/:id
 * @description Permanently delete a REMOVED application and its S3 media (Admin only)
 * @access Private (Admin only)
 */
router.delete(
  '/admin/:id',
  requireAuth,
  requireRole('admin'),
  applicationController.permanentlyDeleteApplicationById,
);

/**
 * @route DELETE /api/applications/:id
 * @description Delete an application by ID
 * @access Private
 */
router.delete('/:id', requireAuth, applicationController.deleteApplicationById);

/**
 * @route GET /api/applications/me
 * @description Get all applications for the authenticated user (all statuses)
 * @access Private
 */
router.get('/me', requireAuth, applicationController.getMyApplications);

/**
 * @route GET /api/applications/admin
 * @description List applications in moderation queue (Admin only)
 * @access Private (Admin only)
 */
router.get('/admin', requireAuth, requireRole('admin'), applicationController.getAdminApplications);

/**
 * @route PATCH /api/applications/admin/:id/review
 * @description Approve or reject an application by ID
 * @access Private (Admin only)
 */
router.patch(
  '/admin/:id/review',
  requireAuth,
  requireRole('admin'),
  applicationController.reviewAdminApplicationById,
);

/**
 * @route PATCH /api/applications/admin/:id/unclaimed
 * @description Set the unclaimed flag on an application (Admin only)
 * @access Private (Admin only)
 */
router.patch(
  '/admin/:id/unclaimed',
  requireAuth,
  requireRole('admin'),
  applicationController.setApplicationUnclaimedStatus,
);

/**
 * @route GET /api/applications/admin/claims
 * @description List all claim requests (Admin only)
 * @access Private (Admin only)
 */
router.get(
  '/admin/claims',
  requireAuth,
  requireRole('admin'),
  applicationController.getAdminClaimRequests,
);

/**
 * @route PATCH /api/applications/admin/claims/:id/review
 * @description Approve or decline a claim request (Admin only)
 * @access Private (Admin only)
 */
router.patch(
  '/admin/claims/:id/review',
  requireAuth,
  requireRole('admin'),
  applicationController.reviewAdminClaimRequest,
);

/**
 * @route POST /api/applications/:id/claim
 * @description Submit a claim request for an unclaimed application
 * @access Private
 */
router.post('/:id/claim', requireAuth, applicationController.claimApplication);

/**
 * @route GET /api/applications/:slug/edit
 * @description Get the owner's own application by slug (any status)
 * @access Private
 */
router.get('/:slug/edit', requireAuth, applicationController.getOwnApplicationBySlug);

/**
 * @route POST /api/applications/:slug/view
 * @description Increment application view count
 * @access Public (Rate-limited)
 */
router.post('/:slug/view', rateLimitViewIncrement, applicationController.incrementViewCount);

/**
 * @route GET /api/applications/:slug
 * @description Get a single application by slug
 * @access Public
 */
router.get('/:slug', applicationController.getApplicationBySlug);


export default router;
