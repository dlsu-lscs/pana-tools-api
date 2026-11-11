import { randomUUID } from 'node:crypto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, SQL, or, ilike, count, asc, desc } from 'drizzle-orm';
import { HttpError } from '@/shared/middleware/error.middleware.js';
import {
  feedback,
  type InsertFeedback,
  type SelectFeedback,
} from './feedback.model.js';
import { type FeedbackListInput } from './dto/feedback-list-query.dto.js';
import { user } from '@/users/user.model.js';

export interface IFeedbackService {
  createFeedback(feedback: InsertFeedback, userId?: string): Promise<SelectFeedback>;
  getFeedback(feedbackId: string): Promise<SelectFeedback>;
  listFeedback(query: FeedbackListInput): Promise<{ data: SelectFeedback[]; total: number; page: number; limit: number }>;
  deleteFeedback(feedbackId: string): Promise<void>;
}

export default class FeedbackService implements IFeedbackService {
  constructor(private readonly db: NodePgDatabase) {}

  /**
   * Validates that the provided userId exists in the user table prior to insertion
   * to provide a clear 404 NOT_FOUND error instead of letting a database foreign key constraint fail.
   */
  private ensureUserExists = async (userId: string): Promise<void> => {
    const [existingUser] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!existingUser) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }
  };

  /**
   * Creates a new feedback entry, allowing an optional userId for unauthenticated visitors (userId = null)
   * while associating verified member sessions and ensuring referenced users exist.
   */
  createFeedback = async (
    insertFeedbackDTO: InsertFeedback,
    userId?: string,
  ): Promise<SelectFeedback> => {
    const targetUserId = userId ?? insertFeedbackDTO.userId;

    if (targetUserId) {
      await this.ensureUserExists(targetUserId);
    }

    const [created] = await this.db
      .insert(feedback)
      .values({
        ...insertFeedbackDTO,
        id: insertFeedbackDTO.id ?? randomUUID(),
        userId: targetUserId ?? null,
      })
      .returning();

    if (!created) {
      throw new HttpError(500, 'Failed to create feedback', 'INTERNAL_SERVER_ERROR');
    }

    return created;
  };

  /**
   * Retrieves a single feedback record by id, throwing a 404 HttpError if not found
   * to avoid exposing database internals to the client.
   */
  getFeedback = async (feedbackId: string): Promise<SelectFeedback> => {
    const [existingFeedback] = await this.db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
      .limit(1);

    if (!existingFeedback) {
      throw new HttpError(404, 'Feedback not found', 'NOT_FOUND');
    }

    return existingFeedback;
  };

  /**
   * Lists feedback entries with pagination and category filtering, ordering by createdAt descending
   * by default to satisfy admin requirements for newest-first chronological presentation.
   */
  listFeedback = async (
    query: FeedbackListInput,
  ): Promise<{ data: SelectFeedback[]; total: number; page: number; limit: number }> => {
    const conditions: SQL[] = [];

    if (query.category) {
      conditions.push(eq(feedback.category, query.category));
    }

    if (query.userId) {
      conditions.push(eq(feedback.userId, query.userId));
    }

    if (query.search && query.search.trim() !== '') {
      const searchPattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(feedback.message, searchPattern),
          ilike(feedback.email, searchPattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const offset = (page - 1) * limit;

    const sortField = query.sortBy ? feedback[query.sortBy] : feedback.createdAt;
    const sortOrderFn = query.sortOrder === 'asc' ? asc : desc;

    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(feedback)
        .where(whereClause)
        .orderBy(sortOrderFn(sortField))
        .limit(limit)
        .offset(offset),

      this.db
        .select({ count: count() })
        .from(feedback)
        .where(whereClause),
    ]);

    const totalCount = countResult[0]?.count ?? 0;

    return {
      data: items,
      total: Number(totalCount),
      page,
      limit,
    };
  };

  /**
   * Deletes a feedback record by id after verifying its existence with a pre-flight query,
   * throwing a 404 HttpError if the target feedback does not exist.
   */
  deleteFeedback = async (feedbackId: string): Promise<void> => {
    const [existingFeedback] = await this.db
      .select({ id: feedback.id })
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
      .limit(1);

    if (!existingFeedback) {
      throw new HttpError(404, 'Feedback not found', 'NOT_FOUND');
    }

    await this.db.delete(feedback).where(eq(feedback.id, feedbackId));
  };
}
