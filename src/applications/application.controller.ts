import type { Request, Response } from 'express';
import type { IApplicationService } from './application.service.js';
import { z } from '@/shared/config/openapi.js';
import {
  ApplicationsListQuerySchema,
  ApplicationSlugParamsSchema,
  ApplicationIdParamsSchema,
  CreateApplicationRequestSchema,
  PatchApplicationRequestSchema,
  ReviewApplicationRequestSchema,
  ApplicationsListResponseSchema,
  ApplicationResponseSchema,
  ClaimApplicationRequestSchema,
  ReviewClaimRequestSchema,
  ClaimRequestsListResponseSchema,
} from './dto/index.js';
import { AdminApplicationsListQuerySchema } from './dto/admin-applications-list-query.dto.js';
import { AdminClaimsListQuerySchema } from './dto/admin-claims-list-query.dto.js';
import { logger } from '@/shared/utils/logger.js';
import { HttpError } from '@/shared/middleware/error.middleware.js';
import {
  sendApplicationStatusEmail,
  sendApplicationSubmittedEmail,
  sendAdminNewSubmissionEmail,
  sendClaimSubmittedEmail,
  sendAdminNewClaimEmail,
} from '@/shared/infrastructure/mailer.js';

export class ApplicationController {
  constructor(private applicationService: IApplicationService) {}

  /**
   * Handles GET requests for applications list with pagination and filtering
   * @route GET /api/applications
   */
  getPaginatedApplications = async (req: Request, res: Response): Promise<void> => {
    const { limit, page, ...filters } = ApplicationsListQuerySchema.parse(req.query);

    logger.debug('Fetching applications', { limit, page, filters });

    const response = await this.applicationService.getPaginatedApplications(limit, page, filters);

    logger.info('Applications retrieved successfully', {
      count: response.data.length,
      total: response.meta.total,
      page,
      limit,
    });

    const parsed = ApplicationsListResponseSchema.parse(response);
    res.status(200).json(parsed);
  };

  /**
   * Handles GET requests for the current user's own applications (all statuses)
   * @route GET /api/applications/me
   */
  getMyApplications = async (req: Request, res: Response): Promise<void> => {
    const authUserId = this.getAuthUserId(res);
    const response = await this.applicationService.getMyApplications(authUserId);
    const parsed = ApplicationsListResponseSchema.parse(response);
    res.status(200).json(parsed);
  };

  /**
   * Handles GET requests for applications in moderation queue (Admin only)
   * @route GET /api/applications/admin
   */
  getAdminApplications = async (req: Request, res: Response): Promise<void> => {
    const { limit, page, ...filters } = AdminApplicationsListQuerySchema.parse(req.query);

    logger.debug('Fetching admin applications', { limit, page, filters });

    const response = await this.applicationService.getAdminApplications(limit, page, filters);

    logger.info('Admin applications retrieved successfully', {
      count: response.data.length,
      total: response.meta.total,
      page,
      limit,
    });

    const parsed = ApplicationsListResponseSchema.parse(response);
    res.status(200).json(parsed);
  };

  /**
   * Handles GET requests for a single application by slug
   * @route GET /api/applications/:slug
   */
  getApplicationBySlug = async (req: Request, res: Response): Promise<void> => {
    const { slug } = ApplicationSlugParamsSchema.parse(req.params);

    logger.debug('Fetching application by slug', { slug });

    const application = await this.applicationService.getApplicationBySlug(slug);

    logger.info('Application retrieved successfully', {
      applicationId: application.id,
      slug: application.slug,
    });

    const parsed = ApplicationResponseSchema.parse(application);
    res.status(200).json(parsed);
  };

  /**
   * Handles GET requests for an owner's own application by slug (any status)
   * @route GET /api/applications/:slug/edit
   */
  getOwnApplicationBySlug = async (req: Request, res: Response): Promise<void> => {
    const { slug } = ApplicationSlugParamsSchema.parse(req.params);
    const authUserId = this.getAuthUserId(res);

    const application = await this.applicationService.getOwnApplicationBySlug(slug, authUserId);

    const parsed = ApplicationResponseSchema.parse(application);
    res.status(200).json(parsed);
  };

  /**
   * @route POST request for creating a single application
   */
  createApplication = async (req: Request, res: Response): Promise<void> => {
    const body = CreateApplicationRequestSchema.parse(req.body);
    const authUserId = this.getAuthUserId(res);

    logger.debug('Creating application', { slug: body.slug });

    await this.applicationService.createApplication(body, authUserId);

    logger.info('Application created successfully', {
      applicationId: authUserId,
      slug: body.slug,
    });

    const [submitter, adminEmails] = await Promise.all([
      this.applicationService.getUserById(authUserId),
      this.applicationService.getAdminEmails(),
    ]);

    await Promise.all([
      sendApplicationSubmittedEmail(submitter.email, {
        userName: submitter.name,
        applicationTitle: body.title,
        applicationSlug: body.slug,
      }),
      sendAdminNewSubmissionEmail(adminEmails, {
        userName: submitter.name,
        userEmail: submitter.email,
        applicationTitle: body.title,
        applicationSlug: body.slug,
      }),
    ]);

    res.status(201).json({ slug: body.slug });
  };

  /**
   * Handles PATCH requests for updating an application
   * @route PATCH /api/applications/:id
   */
  patchApplicationById = async (req: Request, res: Response): Promise<void> => {
    const { id } = ApplicationIdParamsSchema.parse(req.params);
    const body = PatchApplicationRequestSchema.parse(req.body);
    const authUserId = this.getAuthUserId(res);
    const authUserRole = this.getAuthUserRole(res)

    logger.debug('Patching application', { id, updates: body });

    const slug = await this.applicationService.patchApplicationById(id, body, authUserId, authUserRole);

    logger.info('Application patched successfully', {
      applicationId: authUserId,
      slug,
    });

    res.status(200).json({ slug });
  };

  /**
   * Handles DELETE requests for removing an application
   * @route DELETE /api/applications/:id
   */
  deleteApplicationById = async (req: Request, res: Response): Promise<void> => {
    const { id } = ApplicationIdParamsSchema.parse(req.params);
    const authUserId = this.getAuthUserId(res);

    logger.debug('Deleting application', { id });

    await this.applicationService.deleteApplicationById(id, authUserId);

    logger.info('Application deleted successfully', {
      applicationId: authUserId,
      id: id,
    });

    res.status(204).send();
  };

  /**
   * Handles DELETE requests for permanently deleting a REMOVED application (Admin only)
   * @route DELETE /api/applications/admin/:id
   */
  permanentlyDeleteApplicationById = async (req: Request, res: Response): Promise<void> => {
    const { id } = ApplicationIdParamsSchema.parse(req.params);

    logger.debug('Permanently deleting application', { id });

    await this.applicationService.permanentlyDeleteApplicationById(id);

    logger.info('Application permanently deleted', { id });

    res.status(204).send();
  };

  /**
   * Handles PATCH requests for admin review (approve/reject) of an application
   * @route PATCH /api/applications/admin/:id/review
   */
  reviewAdminApplicationById = async (req: Request, res: Response): Promise<void> => {
    const { id } = ApplicationIdParamsSchema.parse(req.params);
    const body = ReviewApplicationRequestSchema.parse(req.body);

    logger.debug('Reviewing application', { id, decision: body.status });

    await this.applicationService.reviewAdminApplicationById(id, body);

    const user = await this.applicationService.getUserByApplicationId(id);

    await sendApplicationStatusEmail(user.email, {
      userName: user.name,
      applicationTitle: user.applicationTitle,
      applicationSlug: user.applicationSlug,
      status: body.status,
      rejectionReason: body.rejectionReason,
    });

    logger.info('Application reviewed successfully', {
      applicationId: id,
      status: body.status,
    });

    res.status(204).send();
  };

  /**
   * Set the unclaimed status of an application (admin)
   * @route PATCH /api/applications/admin/:id/unclaimed
   */
  setApplicationUnclaimedStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = ApplicationIdParamsSchema.parse(req.params);
    const { unclaimed } = z.object({ unclaimed: z.boolean() }).parse(req.body);

    await this.applicationService.setApplicationUnclaimed(id, unclaimed);

    res.status(204).send();
  };

  /**
   * Submit a claim request for an unclaimed application
   * @route POST /api/applications/:id/claim
   */
  claimApplication = async (req: Request, res: Response): Promise<void> => {
    const { id } = ApplicationIdParamsSchema.parse(req.params);
    const body = ClaimApplicationRequestSchema.parse(req.body);
    const authUserId = this.getAuthUserId(res);

    await this.applicationService.submitClaimRequest(id, authUserId, body);

    const [claimant, app, adminEmails] = await Promise.all([
      this.applicationService.getUserById(authUserId),
      this.applicationService.getApplicationById(id),
      this.applicationService.getAdminEmails(),
    ]);

    await Promise.all([
      sendClaimSubmittedEmail(claimant.email, {
        userName: claimant.name,
        applicationTitle: app.title,
        applicationSlug: app.slug,
      }),
      sendAdminNewClaimEmail(adminEmails, {
        userName: claimant.name,
        userEmail: claimant.email,
        applicationTitle: app.title,
        applicationSlug: app.slug,
      }),
    ]);

    res.status(201).json({ message: 'Claim request submitted successfully' });
  };

  /**
   * Handles POST requests to increment view count for an application by slug
   * @route POST /api/applications/:slug/view
   */
  incrementViewCount = async (req: Request, res: Response): Promise<void> => {
    const { slug } = ApplicationSlugParamsSchema.parse(req.params);

    logger.debug('Incrementing view count', { slug });

    await this.applicationService.incrementViewCount(slug);

    logger.info('Application view count incremented', { slug });

    res.status(204).send();
  };

  /**
   * List all claim requests (admin)
   * @route GET /api/applications/admin/claims
   */
  getAdminClaimRequests = async (req: Request, res: Response): Promise<void> => {
    const query = AdminClaimsListQuerySchema.parse(req.query);

    const response = await this.applicationService.getAdminClaimRequests(query);

    const parsed = ClaimRequestsListResponseSchema.parse(response);
    res.status(200).json(parsed);
  };

  /**
   * Approve or decline a claim request (admin)
   * @route PATCH /api/applications/admin/claims/:id/review
   */
  reviewAdminClaimRequest = async (req: Request, res: Response): Promise<void> => {
    const { id } = ApplicationIdParamsSchema.parse(req.params);
    const body = ReviewClaimRequestSchema.parse(req.body);

    await this.applicationService.reviewAdminClaimRequest(id, body);

    res.status(204).send();
  };

  private getAuthUserId(res: Response): string {
    const authUserId = res.locals.authUserId as string | undefined;

    if (!authUserId) {
      throw new HttpError(401, 'Unauthorized', 'UNAUTHORIZED');
    }

    return authUserId;
  }

  private getAuthUserRole(res: Response): string {
    const authUserRole = res.locals.authUserRole as string;


    return authUserRole;
  }
}
