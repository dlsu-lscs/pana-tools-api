import { and, eq, avg } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { HttpError } from '@/shared/middleware/error.middleware.js';
import {
  ApplicationRatingResponseSchema,
  RatingResponseSchema,
  type ApplicationRatingResponse,
  type RatingResponse,
} from './dto/index.js';
import { application, rating, type InsertRating, type SelectRating, user } from './rating.model.js';
import { SelectApplication } from '@/applications/application.model.js';

type RatingWithUserEmail = RatingResponse;

type ApplicationRating = ApplicationRatingResponse;

type RatingWithApplication = Omit<SelectRating, 'userId'> & {
  userId: string | null;
  application: Pick<SelectApplication, 'id' | 'slug' | 'title'>;
};

export interface IRatingService {
  getApplicationRatingBySlug(slug: string): Promise<ApplicationRating>;
  getRatingByUserId(userId: string): Promise<RatingWithApplication[]>;
  createRatingByApplicationSlug(
    slug: string,
    userId: string,
    payload: Required<Pick<InsertRating, 'score'>> & Pick<InsertRating, 'comment' | 'isAnonymous'>,
  ): Promise<RatingWithUserEmail>;
  patchRatingByApplicationSlug(
    slug: string,
    userId: string,
    updates: Partial<Pick<InsertRating, 'score' | 'comment' | 'isAnonymous'>>,
  ): Promise<RatingWithUserEmail>;
  deleteRatingByApplicationSlug(slug: string, userId: string): Promise<RatingWithUserEmail>;
}

export default class RatingService implements IRatingService {
  constructor(private readonly db: NodePgDatabase) {}

  private getApplicationBySlug = async (slug: string): Promise<{ id: number; slug: string }> => {
    const [app] = await this.db
      .select({ id: application.id, slug: application.slug })
      .from(application)
      .where(eq(application.slug, slug))
      .limit(1);

    if (!app) {
      throw new HttpError(404, 'Application not found', 'NOT_FOUND');
    }

    return app;
  };

  private getUserById = async (userId: string): Promise<{ id: string; email: string; name: string }> => {
    const [foundUser] = await this.db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!foundUser) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }

    return foundUser;
  };

  private getRatingByUserAndApplication = async (
    userId: string,
    applicationId: number,
  ): Promise<SelectRating | undefined> => {
    const [ratings] = await this.db
      .select()
      .from(rating)
      .where(and(eq(rating.userId, userId), eq(rating.applicationId, applicationId)))
      .limit(1);

    return ratings;
  };

  private formatRating = (rating: RatingWithUserEmail): RatingWithUserEmail => {
    const isAnonymous = rating.isAnonymous;

    return RatingResponseSchema.parse({
      ...rating,
      isAnonymous,
      userEmail: isAnonymous ? null : rating.userEmail,
      userName: isAnonymous ? null : rating.userName,
    });
  };

  getApplicationRatingBySlug = async (slug: string): Promise<ApplicationRating> => {
    const app = await this.getApplicationBySlug(slug);

    const [averageRows, ratingRows] = await Promise.all([
      this.db
        .select({ average: avg(rating.score) })
        .from(rating)
        .where(eq(rating.applicationId, app.id)),
      this.db
        .select({
          applicationId: rating.applicationId,
          score: rating.score,
          comment: rating.comment,
          isAnonymous: rating.isAnonymous,
          userEmail: user.email,
          userName: user.name,
        })
        .from(rating)
        .innerJoin(user, eq(rating.userId, user.id))
        .where(eq(rating.applicationId, app.id)),
    ]);

    const [average] = averageRows;

    const formattedRatings = ratingRows.map((row) => this.formatRating(row));

    const total = formattedRatings.length;

    return ApplicationRatingResponseSchema.parse({
      applicationSlug: app.slug,
      ratings: formattedRatings,
      total,
      averageScore: parseFloat(Number(average.average).toFixed(2)),
    });
  };

  createRatingByApplicationSlug = async (
    slug: string,
    userId: string,
    payload: Required<Pick<InsertRating, 'score'>> & Pick<InsertRating, 'comment' | 'isAnonymous'>,
  ): Promise<RatingWithUserEmail> => {
    const [app, foundUser] = await Promise.all([
      this.getApplicationBySlug(slug),
      this.getUserById(userId),
    ]);

    const existing = await this.getRatingByUserAndApplication(foundUser.id, app.id);

    if (existing) {
      throw new HttpError(
        409,
        'Rating already exists for this user and application',
        'DUPLICATE_RATING',
      );
    }

    const insertPayload: InsertRating = {
      userId: foundUser.id,
      applicationId: app.id,
      score: payload.score,
      comment: payload.comment ?? null,
      isAnonymous: payload.isAnonymous ?? false,
    };

    await this.db.insert(rating).values(insertPayload);

    return this.formatRating({
      applicationId: app.id,
      score: payload.score,
      comment: payload.comment ?? null,
      isAnonymous: payload.isAnonymous ?? false,
      userEmail: foundUser.email,
      userName: foundUser.name,
    });
  };

  patchRatingByApplicationSlug = async (
    slug: string,
    userId: string,
    updates: Partial<Pick<InsertRating, 'score' | 'comment' | 'isAnonymous'>>,
  ): Promise<RatingWithUserEmail> => {
    const app = await this.getApplicationBySlug(slug);
    const existing = await this.getRatingByUserAndApplication(userId, app.id);

    if (!existing) {
      throw new HttpError(404, 'Rating not found', 'NOT_FOUND');
    }

    const [updatedRows, ownerRows] = await Promise.all([
      this.db
        .update(rating)
        .set({
          score: updates.score,
          comment: updates.comment,
          isAnonymous: updates.isAnonymous,
        })
        .where(
          and(eq(rating.userId, existing.userId), eq(rating.applicationId, existing.applicationId)),
        )
        .returning({
          applicationId: rating.applicationId,
          score: rating.score,
          comment: rating.comment,
          isAnonymous: rating.isAnonymous,
        }),
      this.db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, userId)).limit(1),
    ]);

    const [updated] = updatedRows;
    const [owner] = ownerRows;

    if (!updated) {
      throw new HttpError(404, 'Rating not found', 'NOT_FOUND');
    }

    return this.formatRating({
      ...updated,
      userEmail: owner?.email ?? null,
      userName: owner?.name ?? null,
    });
  };

  deleteRatingByApplicationSlug = async (
    slug: string,
    userId: string,
  ): Promise<RatingWithUserEmail> => {
    const app = await this.getApplicationBySlug(slug);
    const existing = await this.getRatingByUserAndApplication(userId, app.id);

    if (!existing) {
      throw new HttpError(404, 'Rating not found', 'NOT_FOUND');
    }

    const [deletedRows, ownerRows] = await Promise.all([
      this.db
        .delete(rating)
        .where(
          and(eq(rating.userId, existing.userId), eq(rating.applicationId, existing.applicationId)),
        )
        .returning({ applicationId: rating.applicationId }),
      this.db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, userId)).limit(1),
    ]);

    const [deleted] = deletedRows;
    const [owner] = ownerRows;

    if (!deleted) {
      throw new HttpError(404, 'Rating not found', 'NOT_FOUND');
    }

    return this.formatRating({
      applicationId: existing.applicationId,
      score: existing.score,
      comment: existing.comment,
      isAnonymous: existing.isAnonymous ?? false,
      userEmail: owner?.email ?? null,
      userName: owner?.name ?? null,
    });
  };

  getRatingByUserId = async (userId: string): Promise<RatingWithApplication[]> => {
    const rows = await this.db
      .select({
        userId: rating.userId,
        applicationId: rating.applicationId,
        score: rating.score,
        comment: rating.comment,
        isAnonymous: rating.isAnonymous,
        appId: application.id,
        appSlug: application.slug,
        appTitle: application.title,
      })
      .from(rating)
      .innerJoin(application, eq(rating.applicationId, application.id))
      .where(eq(rating.userId, userId));

    return rows.map((row) => ({
      userId: row.isAnonymous ? null : row.userId,
      applicationId: row.applicationId,
      score: row.score,
      comment: row.comment,
      isAnonymous: row.isAnonymous,
      application: { id: row.appId, slug: row.appSlug, title: row.appTitle },
    }));
  };
}
