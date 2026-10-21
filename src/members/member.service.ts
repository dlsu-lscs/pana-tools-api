import { eq, and, or, ilike, asc, desc, count, sql, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { HttpError } from '@/shared/middleware/error.middleware.js';
import { user, application, session, userFavorite, rating } from './member.model.js';
import type {
  MembersListResponse,
  MemberResponse,
  UserApplicationsListResponse,
  MemberReviewsListResponse,
} from './dto/index.js';
import type { MembersListFilters } from './dto/members-list-query.dto.js';

export interface IMemberService {
  getMembers(
    limit: number,
    page: number,
    filters?: MembersListFilters,
  ): Promise<MembersListResponse>;
  getUserApplications(userId: string): Promise<UserApplicationsListResponse>;
  getUserReviews(userId: string): Promise<MemberReviewsListResponse>;
  banMember(targetUserId: string, reason: string, actorUserId: string): Promise<void>;
  unbanMember(targetUserId: string, actorUserId: string): Promise<void>;
  promoteMember(targetUserId: string, actorUserId: string): Promise<void>;
  demoteMember(targetUserId: string, actorUserId: string): Promise<void>;
}

export default class MemberService implements IMemberService {
  constructor(private readonly db: NodePgDatabase) {}

  getMembers = async (
    limit = 20,
    page = 1,
    filters?: MembersListFilters,
  ): Promise<MembersListResponse> => {
    if (limit < 1 || page < 1) {
      throw new HttpError(400, 'Limit and page must be positive numbers', 'VALIDATION_ERROR');
    }

    const safeLimit = Math.min(limit, 100);
    const offset = (page - 1) * safeLimit;

    const conditions = this.buildWhereConditions(filters);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total (no joins — avoids row multiplication)
    const [{ value: total }] = await this.db
      .select({ value: count() })
      .from(user)
      .where(whereClause);

    const sortBy = filters?.sortBy ?? 'lastLogin';
    const sortOrder = filters?.sortOrder ?? 'desc';

    // Use DISTINCT CASE WHEN to avoid cross-join row multiplication.
    // Joining userFavorite × application × session produces N_fav × N_app × N_session rows
    // per user, so plain count() inflates every aggregate. DISTINCT on the PK collapses them.
    const lastLoginExpr = sql`max(${session.createdAt})`;
    const favoritesExpr = sql`count(distinct ${userFavorite.applicationId})`;
    const totalAppExpr = sql`count(distinct ${application.id})`;
    const bannedExpr = sql`${user.banned}`;

    let orderByClause;
    switch (sortBy) {
      case 'favoritesCount':
        orderByClause = sortOrder === 'asc' ? asc(favoritesExpr) : desc(favoritesExpr);
        break;
      case 'totalAppCount':
        orderByClause = sortOrder === 'asc' ? asc(totalAppExpr) : desc(totalAppExpr);
        break;
      case 'banned':
        orderByClause = sortOrder === 'asc' ? asc(bannedExpr) : desc(bannedExpr);
        break;
      case 'lastLogin':
      default:
        orderByClause = sortOrder === 'asc' ? asc(lastLoginExpr) : desc(lastLoginExpr);
        break;
    }

    const rows = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires,
        tosAccepted: user.tosAccepted,
        tosAcceptedAt: user.tosAcceptedAt,
        createdAt: user.createdAt,
        favoritesCount: sql<number>`count(distinct ${userFavorite.applicationId})::int`,
        reviewsCount:   sql<number>`count(distinct ${rating.applicationId})::int`,
        // DISTINCT CASE WHEN deduplicates application.id per-status before counting
        pendingCount:  sql<number>`count(distinct case when ${application.status} = 'PENDING'  then ${application.id} end)::int`,
        approvedCount: sql<number>`count(distinct case when ${application.status} = 'APPROVED' then ${application.id} end)::int`,
        changesRequestedCount: sql<number>`count(distinct case when ${application.status} = 'CHANGES_REQUESTED' then ${application.id} end)::int`,
        removedCount:  sql<number>`count(distinct case when ${application.status} = 'REMOVED'  then ${application.id} end)::int`,
        lastLogin: sql<string | null>`max(${session.createdAt})`,
      })
      .from(user)
      .leftJoin(userFavorite, eq(user.id, userFavorite.userId))
      .leftJoin(application, eq(user.id, application.userId))
      .leftJoin(session, eq(user.id, session.userId))
      .leftJoin(rating, eq(user.id, rating.userId))
      .where(whereClause)
      .groupBy(user.id)
      .having(this.buildHavingClause(filters))
      .orderBy(orderByClause)
      .limit(safeLimit)
      .offset(offset);

    const data = rows.map((row) => ({
      ...row,
      banExpires: row.banExpires?.toISOString() ?? null,
      lastLogin: row.lastLogin ?? null,
    })) as unknown as MemberResponse[];

    const totalPages = Math.ceil(total / safeLimit);

    return {
      data,
      meta: { page, limit: safeLimit, count: data.length, total, totalPages },
    };
  };

  getUserApplications = async (targetUserId: string): Promise<UserApplicationsListResponse> => {
    await this.assertUserExists(targetUserId);

    const data = await this.db
      .select({
        id: application.id,
        title: application.title,
        slug: application.slug,
        description: application.description,
        url: application.url,
        icon: application.icon,
        previewImages: application.previewImages,
        tags: application.tags,
        status: application.status,
        rejectionReason: application.rejectionReason,
        createdAt: application.createdAt,
      })
      .from(application)
      .where(eq(application.userId, targetUserId))
      .orderBy(desc(application.createdAt));

    return { data };
  };

  getUserReviews = async (targetUserId: string): Promise<MemberReviewsListResponse> => {
    await this.assertUserExists(targetUserId);

    const data = await this.db
      .select({
        applicationId: rating.applicationId,
        applicationTitle: application.title,
        applicationSlug: application.slug,
        score: rating.score,
        comment: rating.comment,
        isAnonymous: rating.isAnonymous,
      })
      .from(rating)
      .innerJoin(application, eq(rating.applicationId, application.id))
      .where(eq(rating.userId, targetUserId))
      .orderBy(desc(rating.score));

    return { data };
  };

  banMember = async (
    targetUserId: string,
    reason: string,
    actorUserId: string,
  ): Promise<void> => {
    if (targetUserId === actorUserId) {
      throw new HttpError(403, 'You cannot ban yourself', 'FORBIDDEN');
    }
    await this.assertUserExists(targetUserId);
    await this.db
      .update(user)
      .set({ banned: true, banReason: reason, banExpires: null })
      .where(eq(user.id, targetUserId));
  };

  unbanMember = async (targetUserId: string, actorUserId: string): Promise<void> => {
    if (targetUserId === actorUserId) {
      throw new HttpError(403, 'You cannot unban yourself', 'FORBIDDEN');
    }
    await this.assertUserExists(targetUserId);
    await this.db
      .update(user)
      .set({ banned: false, banReason: null, banExpires: null })
      .where(eq(user.id, targetUserId));
  };

  promoteMember = async (targetUserId: string, actorUserId: string): Promise<void> => {
    if (targetUserId === actorUserId) {
      throw new HttpError(403, 'You cannot promote yourself', 'FORBIDDEN');
    }
    await this.assertUserExists(targetUserId);
    await this.db.update(user).set({ role: 'admin' }).where(eq(user.id, targetUserId));
  };

  demoteMember = async (targetUserId: string, actorUserId: string): Promise<void> => {
    if (targetUserId === actorUserId) {
      throw new HttpError(403, 'You cannot demote yourself', 'FORBIDDEN');
    }
    await this.assertUserExists(targetUserId);
    await this.db.update(user).set({ role: 'user' }).where(eq(user.id, targetUserId));
  };

  private buildWhereConditions(filters?: MembersListFilters) {
    const conditions: ReturnType<typeof eq>[] = [];

    if (filters?.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(
        or(ilike(user.name, pattern), ilike(user.email, pattern))! as ReturnType<typeof eq>,
      );
    }

    if (filters?.banned === 'true') {
      conditions.push(eq(user.banned, true));
    } else if (filters?.banned === 'false') {
      conditions.push(
        or(eq(user.banned, false), sql`${user.banned} is null`)! as ReturnType<typeof eq>,
      );
    }

    if (filters?.role) {
      conditions.push(eq(user.role, filters.role));
    }

    if (filters?.excludeRole) {
      conditions.push(
        or(
          ne(user.role, filters.excludeRole),
          sql`${user.role} is null`,
        )! as ReturnType<typeof eq>,
      );
    }

    return conditions;
  }

  private buildHavingClause(filters?: MembersListFilters) {
    if (filters?.hasApps === 'true') {
      return sql`count(distinct ${application.id}) > 0`;
    }
    return undefined;
  }

  private assertUserExists = async (targetUserId: string): Promise<void> => {
    const [existing] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, targetUserId))
      .limit(1);

    if (!existing) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }
  };
}
