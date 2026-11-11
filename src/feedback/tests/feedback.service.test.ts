import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PGlite } from '@electric-sql/pglite';
import { createTestDatabase } from '@/shared/config/test-database.js';
import FeedbackService from '../feedback.service.js';
import { feedback } from '../feedback.model.js';
import { user } from '@/users/user.model.js';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let db: PgliteDatabase;
  let client: PGlite;

  const testUser = {
    id: 'feedback-test-user-1',
    name: 'Feedback Test User',
    email: 'feedback-user@example.com',
  };

  beforeAll(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db as unknown as PgliteDatabase;
    client = testDb.client;

    service = new FeedbackService(db as unknown as NodePgDatabase);

    await db.insert(user).values([
      {
        id: testUser.id,
        name: testUser.name,
        email: testUser.email,
      },
    ]);
  });

  afterEach(async () => {
    await db.delete(feedback);
  });

  afterAll(async () => {
    await client.close();
  });

  describe('createFeedback', () => {
    it('should create feedback for an unauthenticated visitor with null userId', async () => {
      const created = await service.createFeedback({
        category: 'bug',
        message: 'Encountered a bug on the login screen.',
        email: 'visitor@example.com',
      });

      expect(created.id).toBeDefined();
      expect(created.userId).toBeNull();
      expect(created.category).toBe('bug');
      expect(created.message).toBe('Encountered a bug on the login screen.');
      expect(created.email).toBe('visitor@example.com');
      expect(created.createdAt).toBeInstanceOf(Date);
    });

    it('should create feedback for an authenticated user with verified userId', async () => {
      const created = await service.createFeedback(
        {
          category: 'feature_request',
          message: 'Please add dark mode support to the platform.',
          email: testUser.email,
        },
        testUser.id,
      );

      expect(created.id).toBeDefined();
      expect(created.userId).toBe(testUser.id);
      expect(created.category).toBe('feature_request');
      expect(created.message).toBe('Please add dark mode support to the platform.');
    });

    it('should throw 404 when userId does not exist in users table', async () => {
      await expect(
        service.createFeedback(
          {
            category: 'general',
            message: 'Feedback from nonexistent user account.',
          },
          'non-existent-user-id',
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('getFeedback', () => {
    it('should retrieve existing feedback record by id', async () => {
      const created = await service.createFeedback({
        category: 'improvement',
        message: 'Optimize table rendering performance.',
      });

      const retrieved = await service.getFeedback(created.id);
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.message).toBe('Optimize table rendering performance.');
    });

    it('should throw 404 when feedback does not exist', async () => {
      await expect(service.getFeedback('non-existent-feedback-id')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('listFeedback', () => {
    it('should return feedback in descending chronological order with pagination metadata', async () => {
      const first = await service.createFeedback({
        category: 'bug',
        message: 'First feedback entry submitted.',
      });

      const second = await service.createFeedback({
        category: 'general',
        message: 'Second feedback entry submitted.',
      });

      const result = await service.listFeedback({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.data.length).toBe(2);
      expect(result.data[0].id).toBe(second.id);
      expect(result.data[1].id).toBe(first.id);
    });

    it('should filter feedback by category', async () => {
      await service.createFeedback({
        category: 'bug',
        message: 'Feedback classified as bug.',
      });

      await service.createFeedback({
        category: 'feature_request',
        message: 'Feedback classified as feature request.',
      });

      const result = await service.listFeedback({
        category: 'bug',
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      });

      expect(result.total).toBe(1);
      expect(result.data.length).toBe(1);
      expect(result.data[0].category).toBe('bug');
    });

    it('should filter feedback by search term', async () => {
      await service.createFeedback({
        category: 'general',
        message: 'Need help with account authentication.',
        email: 'user1@example.com',
      });

      await service.createFeedback({
        category: 'improvement',
        message: 'UI alignment looks off on mobile.',
        email: 'user2@example.com',
      });

      const result = await service.listFeedback({
        search: 'authentication',
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      });

      expect(result.total).toBe(1);
      expect(result.data[0].message).toContain('authentication');
    });
  });

  describe('deleteFeedback', () => {
    it('should delete existing feedback record', async () => {
      const created = await service.createFeedback({
        category: 'general',
        message: 'Feedback entry to be removed.',
      });

      await service.deleteFeedback(created.id);

      await expect(service.getFeedback(created.id)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('should throw 404 when deleting nonexistent feedback', async () => {
      await expect(service.deleteFeedback('missing-feedback-id')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });
});
