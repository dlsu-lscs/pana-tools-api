import type {
  ApplicationResponse,
  ApplicationsListFilters,
  ApplicationsListResponse,
  CreateApplicationRequest,
  PatchApplicationRequest,
  ClaimApplicationRequest,
  ReviewClaimRequest,
  ClaimRequestsListResponse,
} from './dto/index.js';
import type { AdminApplicationsListFilters } from './dto/admin-applications-list-query.dto.js';
import type { AdminClaimsListQuery } from './dto/admin-claims-list-query.dto.js';
import {
  eq,
  SQL,
  gte,
  lte,
  between,
  and,
  or,
  ilike,
  asc,
  desc,
  count,
  arrayOverlaps,
  sql,
  getColumns,
} from 'drizzle-orm';
import { APPLICATION_CONSTANTS } from './application.constants.js';
import { HttpError } from '@/shared/middleware/error.middleware.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  userFavorite,
  application,
  user,
  rating,
  applicationClaimRequest,
} from './application.model.js';
import type { ReviewApplicationRequest } from './dto/review-application-request.dto.js';
import { getDbErrorMessage } from '@/shared/utils/dbErrorUtils.js';
import { assertOwnershipOrAdmin } from '../shared/utils/auth.utils.js';
import { deleteS3ImageObjects } from '@/shared/infrastructure/s3/image-cleanup.js';

export interface IApplicationService {
  getPaginatedApplications(
    limit: number,
    page: number,
    filters?: ApplicationsListFilters,
  ): Promise<ApplicationsListResponse>;
  getAdminApplications(
    limit: number,
    page: number,
    filters?: AdminApplicationsListFilters,
  ): Promise<ApplicationsListResponse>;
  getMyApplications(userId: string): Promise<ApplicationsListResponse>;
  getApplicationBySlug(slug: string): Promise<ApplicationResponse>;
  getOwnApplicationBySlug(slug: string, actorUserId: string): Promise<ApplicationResponse>;
  createApplication(app: CreateApplicationRequest, actorUserId: string): Promise<void>;
  patchApplicationById(
    id: number,
    updates: PatchApplicationRequest,
    actorUserId: string,
    role: string,
  ): Promise<string>;
  reviewAdminApplicationById(id: number, input: ReviewApplicationRequest): Promise<void>;
  deleteApplicationById(id: number, actorUserId: string): Promise<void>;
  permanentlyDeleteApplicationById(id: number): Promise<void>;
  getUserByApplicationId(appId: number): Promise<{
    id: string;
    email: string;
    name: string;
    applicationTitle: string;
    applicationSlug: string;
  }>;
  getUserById(userId: string): Promise<{ id: string; email: string; name: string }>;
  getApplicationById(id: number): Promise<{ title: string; slug: string }>;
  getAdminEmails(): Promise<string[]>;
  setApplicationUnclaimed(id: number, unclaimed: boolean): Promise<void>;
  submitClaimRequest(
    applicationId: number,
    userId: string,
    input: ClaimApplicationRequest,
  ): Promise<void>;
  getAdminClaimRequests(query: AdminClaimsListQuery): Promise<ClaimRequestsListResponse>;
  reviewAdminClaimRequest(claimId: number, input: ReviewClaimRequest): Promise<void>;
  incrementViewCount(slug: string): Promise<void>;
}

export default class ApplicationService implements IApplicationService {
  constructor(private readonly db: NodePgDatabase) { }

  getPaginatedApplications = async (
    limit: number = APPLICATION_CONSTANTS.DEFAULT_LIMIT,
    page: number = APPLICATION_CONSTANTS.DEFAULT_PAGE,
    filters?: ApplicationsListFilters,
  ): Promise<ApplicationsListResponse> => {
    return this.getFilteredApplications(limit, page, filters, eq(application.status, 'APPROVED'));
  };

  getMyApplications = async (userId: string): Promise<ApplicationsListResponse> => {
    const allStatuses = or(
      eq(application.status, 'PENDING'),
      eq(application.status, 'APPROVED'),
      eq(application.status, 'CHANGES_REQUESTED'),
      eq(application.status, 'REMOVED'),
    )!;
    return this.getFilteredApplications(
      APPLICATION_CONSTANTS.MAX_LIMIT,
      1,
      { userId },
      allStatuses,
    );
  };

  getAdminApplications = async (
    limit: number = APPLICATION_CONSTANTS.DEFAULT_LIMIT,
    page: number = APPLICATION_CONSTANTS.DEFAULT_PAGE,
    filters?: AdminApplicationsListFilters,
  ): Promise<ApplicationsListResponse> => {
    const statusCondition = filters?.status
      ? eq(application.status, filters.status)
      : or(
        eq(application.status, 'PENDING'),
        eq(application.status, 'CHANGES_REQUESTED'),
        eq(application.status, 'REMOVED'),
      )!;

    return this.getFilteredApplications(limit, page, filters, statusCondition);
  };

  private getFilteredApplications = async (
    limit: number,
    page: number,
    filters: ApplicationsListFilters | AdminApplicationsListFilters | undefined,
    statusCondition: SQL,
  ): Promise<ApplicationsListResponse> => {
    if (limit < 1 || page < 1) {
      throw new HttpError(400, 'Limit and page must be positive numbers', 'VALIDATION_ERROR');
    }

    const safeLimit = Math.min(limit, APPLICATION_CONSTANTS.MAX_LIMIT);
    const offset = (page - 1) * safeLimit;

    const createdAfter = filters?.createdAfter ? new Date(filters.createdAfter) : undefined;
    const createdBefore = filters?.createdBefore ? new Date(filters.createdBefore) : undefined;
    const tags = filters?.tags;
    const userId = filters?.userId;
    const search = filters?.search;
    const sortBy = filters?.sortBy ?? 'createdAt';
    const sortOrder = filters?.sortOrder ?? 'desc';

    const conditions: SQL[] = [statusCondition];

    if (createdAfter !== undefined && createdBefore !== undefined) {
      conditions.push(between(application.createdAt, createdAfter, createdBefore));
    } else if (createdAfter !== undefined) {
      conditions.push(gte(application.createdAt, createdAfter));
    } else if (createdBefore !== undefined) {
      conditions.push(lte(application.createdAt, createdBefore));
    }

    if (userId != null) {
      conditions.push(eq(application.userId, userId));
    }

    if (tags != null && tags.length > 0) {
      conditions.push(arrayOverlaps(application.tags, tags));
    }

    if (search != null && search.trim() !== '') {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(ilike(application.title, searchPattern), ilike(application.description, searchPattern))!,
      );
    }

    // Popularity & standard sort expressions
    const favoritesCountExpr = sql`count(distinct ${userFavorite.userId})`;
    const ratingCountExpr = sql`count(distinct ${rating.userId})`;
    const avgRatingExpr = sql`avg(${rating.score})`;

    let orderByClause: SQL;
    switch (sortBy) {
      case 'title':
        orderByClause = sortOrder === 'asc' ? asc(application.title) : desc(application.title);
        break;
      case 'updatedAt':
        orderByClause = sortOrder === 'asc' ? asc(application.updatedAt) : desc(application.updatedAt);
        break;
      case 'viewCount':
        orderByClause = sortOrder === 'asc' ? asc(application.viewCount) : desc(application.viewCount);
        break;
      case 'favoritesCount':
        orderByClause =
          sortOrder === 'asc'
            ? sql`${favoritesCountExpr} ASC, ${application.id} ASC`
            : sql`${favoritesCountExpr} DESC, ${application.id} DESC`;
        break;
      case 'ratingCount':
        orderByClause =
          sortOrder === 'asc'
            ? sql`${ratingCountExpr} ASC, ${application.id} ASC`
            : sql`${ratingCountExpr} DESC, ${application.id} DESC`;
        break;
      case 'averageRating':
        orderByClause =
          sortOrder === 'asc'
            ? sql`${avgRatingExpr} ASC NULLS FIRST, ${application.id} ASC`
            : sql`${avgRatingExpr} DESC NULLS LAST, ${application.id} DESC`;
        break;
      case 'createdAt':
      default:
        orderByClause = sortOrder === 'asc' ? asc(application.createdAt) : desc(application.createdAt);
        break;
    }

    const whereClause = and(...conditions);

    const [value] = await this.db.select({ value: count() }).from(application).where(whereClause);

    const total = value.value;

    const data = await this.db
      .select({
        ...getColumns(application),
        userEmail: user.email,
        favoritesCount: sql<number>`count(distinct ${userFavorite.userId})::int`,
        ratingCount: sql<number>`count(distinct ${rating.userId})::int`,
        averageRating: sql<number | null>`avg(${rating.score})`,
      })
      .from(application)
      .innerJoin(user, eq(application.userId, user.id))
      .leftJoin(userFavorite, eq(application.id, userFavorite.applicationId))
      .leftJoin(rating, eq(application.id, rating.applicationId))
      .where(whereClause)
      .groupBy(application.id, user.email)
      .orderBy(orderByClause)
      .limit(safeLimit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit: limit,
        count: data.length,
        total,
        totalPages,
      },
    };
  };

  incrementViewCount = async (slug: string): Promise<void> => {
    const [result] = await this.db
      .update(application)
      .set({
        viewCount: sql`${application.viewCount} + 1`,
      })
      .where(and(eq(application.slug, slug), eq(application.status, 'APPROVED')))
      .returning({ id: application.id });

    if (!result) {
      throw new HttpError(404, 'Application not found', 'NOT_FOUND');
    }
  };

  getApplicationBySlug = async (slug: string): Promise<ApplicationResponse> => {
    const [result] = await this.db
      .select({
        ...getColumns(application),
        userEmail: user.email,
        favoritesCount: sql<number>`count(distinct ${userFavorite.userId})::int`,
        ratingCount: sql<number>`count(distinct ${rating.userId})::int`,
        averageRating: sql<number | null>`avg(${rating.score})`,
      })
      .from(application)
      .innerJoin(user, eq(application.userId, user.id))
      .leftJoin(userFavorite, eq(application.id, userFavorite.applicationId))
      .leftJoin(rating, eq(application.id, rating.applicationId))
      .where(and(eq(application.slug, slug), eq(application.status, 'APPROVED')))
      .groupBy(application.id, user.email)
      .limit(1);

    if (!result) {
      throw new HttpError(404, 'Application not found', 'NOT_FOUND');
    }

    return result;
  };

  getOwnApplicationBySlug = async (
    slug: string,
    actorUserId: string,
  ): Promise<ApplicationResponse> => {
    const [result] = await this.db
      .select({
        ...getColumns(application),
        userEmail: user.email,
        favoritesCount: sql<number>`count(distinct ${userFavorite.userId})::int`,
        ratingCount: sql<number>`count(distinct ${rating.userId})::int`,
        averageRating: sql<number | null>`avg(${rating.score})`,
      })
      .from(application)
      .innerJoin(user, eq(application.userId, user.id))
      .leftJoin(userFavorite, eq(application.id, userFavorite.applicationId))
      .leftJoin(rating, eq(application.id, rating.applicationId))
      .where(and(eq(application.slug, slug), eq(application.userId, actorUserId)))
      .groupBy(application.id, user.email)
      .limit(1);

    if (!result) {
      throw new HttpError(404, 'Application not found', 'NOT_FOUND');
    }

    return result;
  };

  createApplication = async (app: CreateApplicationRequest, actorUserId: string): Promise<void> => {
    const [existingUser] = await this.db
      .select({ id: user.id, tosAccepted: user.tosAccepted })
      .from(user)
      .where(eq(user.id, actorUserId))
      .limit(1);

    if (!existingUser) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }

    if (!existingUser.tosAccepted) {
      throw new HttpError(
        403,
        'You must accept the Terms of Service before submitting an application',
        'TOS_NOT_ACCEPTED',
      );
    }

    if (await this.slugExists(app.slug)) {
      throw new HttpError(409, 'Application with this slug already exists', 'DUPLICATE_SLUG');
    }

    await this.db.insert(application).values({
      ...app,
      userId: actorUserId,
      status: 'PENDING',
      rejectionReason: null,
      viewCount: 0,
    });
  };

  patchApplicationById = async (
    id: number,
    updates: PatchApplicationRequest,
    actorUserId: string,
    role: string,
  ): Promise<string> => {
    if (Object.keys(updates).length === 0) {
      return this.getApplicationSlugById(id);
    }

    const [current] = await this.db
      .select()
      .from(application)
      .where(and(eq(application.id, id)))
      .limit(1);

    if (!current) {
      throw new HttpError(404, 'Application not found', 'NOT_FOUND');
    }

    assertOwnershipOrAdmin(actorUserId, current.userId, role);

    const setPayload: PatchApplicationRequest & { status?: typeof application.status._.data } = {
      ...updates,
    };

    // Author edits send the app back for re-review; admin edits are already
    // reviewed by definition, so they leave the current status untouched.
    if (role !== 'admin' && (current.status === 'CHANGES_REQUESTED' || current.status === 'APPROVED')) {
      setPayload.status = 'PENDING';
    }

    const orphanedKeys: Array<string | null | undefined> = [];

    if (updates.icon !== undefined && updates.icon !== current.icon) {
      orphanedKeys.push(current.icon);
    }

    if (updates.previewImages !== undefined) {
      const incoming = new Set(updates.previewImages ?? []);
      for (const key of current.previewImages ?? []) {
        if (!incoming.has(key)) {
          orphanedKeys.push(key);
        }
      }
    }

    let patched: { slug: string } | undefined;

    try {
      [patched] = await this.db
        .update(application)
        .set(setPayload)
        .where(eq(application.id, id))
        .returning({ slug: application.slug });
    } catch (error) {
      const { message, constraint } = getDbErrorMessage(error);
      console.error('Database operation failed:', { message, constraint, originalError: error });
      throw new HttpError(409, 'Application with this slug already exists', 'DUPLICATE_SLUG');
    }

    if (!patched) {
      throw new HttpError(404, 'Application not found', 'NOT_FOUND');
    }

    if (orphanedKeys.length > 0) {
      await deleteS3ImageObjects(orphanedKeys);
    }

    return patched.slug;
  };

  reviewAdminApplicationById = async (
    id: number,
    input: ReviewApplicationRequest,
  ): Promise<void> => {
    const [existing] = await this.db
      .select()
      .from(application)
      .where(eq(application.id, id))
      .limit(1);

    if (!existing) {
      throw new HttpError(404, 'Application not found', 'NOT_FOUND');
    }

    if (existing.status === 'APPROVED' && input.status !== 'REMOVED') {
      throw new HttpError(
        409,
        'Approved applications can only transition to REMOVED',
        'INVALID_APPLICATION_STATE',
      );
    }

    if (
      (input.status === 'CHANGES_REQUESTED' || input.status === 'REMOVED') &&
      !input.rejectionReason
    ) {
      throw new HttpError(
        400,
        'Reason is required when requesting changes or removing an application',
        'VALIDATION_ERROR',
      );
    }

    if (input.status === 'APPROVED' && input.rejectionReason != null) {
      throw new HttpError(
        400,
        'Rejection reason must be null when approving an application',
        'VALIDATION_ERROR',
      );
    }

    await this.db
      .update(application)
      .set({
        status: input.status,
        rejectionReason:
          input.status === 'CHANGES_REQUESTED' || input.status === 'REMOVED'
            ? input.rejectionReason
            : null,
      })
      .where(eq(application.id, id))
      .returning();
  };

  deleteApplicationById = async (id: number, actorUserId: string): Promise<void> => {
    const [existing] = await this.db
      .select({
        id: application.id,
        userId: application.userId,
      })
      .from(application)
      .where(eq(application.id, id))
      .limit(1);

    if (!existing) {
      throw new HttpError(404, 'Application not found', 'NOT_FOUND');
    }

    if (existing.userId !== actorUserId) {
      throw new HttpError(403, 'Forbidden', 'FORBIDDEN');
    }

    await this.db
      .update(application)
      .set({
        status: 'REMOVED',
        rejectionReason: 'Deleted by owner',
      })
      .where(eq(application.id, id));
  };

  permanentlyDeleteApplicationById = async (id: number): Promise<void> => {
    const [existing] = await this.db
      .select({
        id: application.id,
        status: application.status,
        icon: application.icon,
        previewImages: application.previewImages,
      })
      .from(application)
      .where(eq(application.id, id))
      .limit(1);

    if (!existing) {
      throw new HttpError(404, 'Application not found', 'NOT_FOUND');
    }

    if (existing.status !== 'REMOVED') {
      throw new HttpError(400, 'Only REMOVED applications can be permanently deleted', 'INVALID_STATUS');
    }

    await deleteS3ImageObjects([existing.icon, ...(existing.previewImages ?? [])]);

    await this.db.delete(application).where(eq(application.id, id));
  };

  getUserByApplicationId = async (
    appId: number,
  ): Promise<{
    id: string;
    email: string;
    name: string;
    applicationTitle: string;
    applicationSlug: string;
  }> => {
    const [result] = await this.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        applicationTitle: application.title,
        applicationSlug: application.slug,
      })
      .from(application)
      .innerJoin(user, eq(application.userId, user.id))
      .where(eq(application.id, appId))
      .limit(1);
    return result;
  };

  setApplicationUnclaimed = async (id: number, unclaimed: boolean): Promise<void> => {
    const [existing] = await this.db
      .select({ id: application.id })
      .from(application)
      .where(eq(application.id, id))
      .limit(1);

    if (!existing) {
      throw new HttpError(404, 'Application not found', 'NOT_FOUND');
    }

    await this.db.update(application).set({ unclaimed }).where(eq(application.id, id));
  };

  submitClaimRequest = async (
    applicationId: number,
    userId: string,
    input: ClaimApplicationRequest,
  ): Promise<void> => {
    const [app] = await this.db
      .select({ id: application.id, unclaimed: application.unclaimed })
      .from(application)
      .where(eq(application.id, applicationId))
      .limit(1);

    if (!app) {
      throw new HttpError(404, 'Application not found', 'NOT_FOUND');
    }

    if (!app.unclaimed) {
      throw new HttpError(409, 'Application is not unclaimed', 'INVALID_APPLICATION_STATE');
    }

    const [existing] = await this.db
      .select({ id: applicationClaimRequest.id, status: applicationClaimRequest.status })
      .from(applicationClaimRequest)
      .where(
        and(
          eq(applicationClaimRequest.applicationId, applicationId),
          eq(applicationClaimRequest.userId, userId),
        ),
      )
      .limit(1);

    if (existing && (existing.status === 'PENDING' || existing.status === 'APPROVED')) {
      throw new HttpError(
        409,
        'You already have an active claim for this application',
        'DUPLICATE_CLAIM',
      );
    }

    if (existing) {
      await this.db
        .update(applicationClaimRequest)
        .set({ additionalInfo: input.additionalInfo ?? null, status: 'PENDING' })
        .where(eq(applicationClaimRequest.id, existing.id));
    } else {
      await this.db.insert(applicationClaimRequest).values({
        applicationId,
        userId,
        additionalInfo: input.additionalInfo ?? null,
        status: 'PENDING',
      });
    }
  };

  getAdminClaimRequests = async (
    query: AdminClaimsListQuery,
  ): Promise<ClaimRequestsListResponse> => {
    const { page, limit, status } = query;
    const offset = (page - 1) * limit;

    const statusCondition = status ? eq(applicationClaimRequest.status, status) : undefined;
    const whereClause = statusCondition ?? sql`1=1`;

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(applicationClaimRequest)
      .where(whereClause);

    const rows = await this.db
      .select({
        id: applicationClaimRequest.id,
        applicationId: applicationClaimRequest.applicationId,
        applicationTitle: application.title,
        applicationSlug: application.slug,
        userId: applicationClaimRequest.userId,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
        additionalInfo: applicationClaimRequest.additionalInfo,
        status: applicationClaimRequest.status,
        createdAt: applicationClaimRequest.createdAt,
        updatedAt: applicationClaimRequest.updatedAt,
      })
      .from(applicationClaimRequest)
      .innerJoin(application, eq(applicationClaimRequest.applicationId, application.id))
      .innerJoin(user, eq(applicationClaimRequest.userId, user.id))
      .where(whereClause)
      .orderBy(desc(applicationClaimRequest.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      meta: {
        page,
        limit,
        count: rows.length,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  };

  reviewAdminClaimRequest = async (claimId: number, input: ReviewClaimRequest): Promise<void> => {
    const [claim] = await this.db
      .select()
      .from(applicationClaimRequest)
      .where(eq(applicationClaimRequest.id, claimId))
      .limit(1);

    if (!claim) {
      throw new HttpError(404, 'Claim request not found', 'NOT_FOUND');
    }

    if (claim.status !== 'PENDING') {
      throw new HttpError(409, 'Only PENDING claims can be reviewed', 'INVALID_APPLICATION_STATE');
    }

    if (input.status === 'APPROVED') {
      await this.db
        .update(application)
        .set({ userId: claim.userId, unclaimed: false })
        .where(eq(application.id, claim.applicationId));

      await this.db
        .update(applicationClaimRequest)
        .set({ status: 'DECLINED' })
        .where(
          and(
            eq(applicationClaimRequest.applicationId, claim.applicationId),
            eq(applicationClaimRequest.status, 'PENDING'),
          ),
        );
    }

    await this.db
      .update(applicationClaimRequest)
      .set({ status: input.status })
      .where(eq(applicationClaimRequest.id, claimId));
  };

  getUserById = async (userId: string): Promise<{ id: string; email: string; name: string }> => {
    const [result] = await this.db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return result;
  };

  getApplicationById = async (id: number): Promise<{ title: string; slug: string }> => {
    const [result] = await this.db
      .select({ title: application.title, slug: application.slug })
      .from(application)
      .where(eq(application.id, id))
      .limit(1);
    if (!result) {
      throw new HttpError(404, 'Application not found', 'NOT_FOUND');
    }
    return result;
  };

  getAdminEmails = async (): Promise<string[]> => {
    const results = await this.db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.role, 'admin'));
    return results.map((r) => r.email);
  };

  private slugExists = async (slug: string): Promise<boolean> => {
    const [result] = await this.db
      .select({ id: application.id })
      .from(application)
      .where(eq(application.slug, slug))
      .limit(1);

    return !!result;
  };

  private getApplicationSlugById = async (applicationId: number): Promise<string> => {
    const [result] = await this.db
      .select({ slug: application.slug })
      .from(application)
      .where(eq(application.id, applicationId))
      .limit(1);

    if (!result) {
      throw new HttpError(404, 'Application not found', 'NOT_FOUND');
    }

    return result.slug;
  };

}