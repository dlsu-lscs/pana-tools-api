import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PGlite } from '@electric-sql/pglite';
import { createTestDatabase } from '@/shared/config/test-database.js';
import RatingsService from '../rating.service.js';
import { application, rating, user } from '../rating.model.js';

describe('RatingsService', () => {
  let service: RatingsService;
  let db: PgliteDatabase;
  let client: PGlite;

  const firstUser = {
    id: 'ratings-user-1',
    email: 'ratings-user-1@example.com',
  };

  const secondUser = {
    id: 'ratings-user-2',
    email: 'ratings-user-2@example.com',
  };

  beforeAll(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db as unknown as PgliteDatabase;
    client = testDb.client;

    service = new RatingsService(db as unknown as NodePgDatabase);

    await db.insert(user).values([
      {
        id: firstUser.id,
        name: 'Ratings User One',
        email: firstUser.email,
      },
      {
        id: secondUser.id,
        name: 'Ratings User Two',
        email: secondUser.email,
      },
    ]);

    await db.insert(application).values([
      {
        title: 'Ratings App One',
        slug: 'ratings-app-one',
        userId: firstUser.id,
        status: 'APPROVED',
        githubLink: 'https://github.com/user/repo',
        rejectionReason: null,
      },
      {
        title: 'Ratings App Two',
        slug: 'ratings-app-two',
        userId: firstUser.id,
        status: 'APPROVED',
        githubLink: 'https://github.com/user/repo',
        rejectionReason: null,
      },
    ]);
  });

  afterEach(async () => {
    await db.delete(rating);
  });

  afterAll(async () => {
    await client.close();
  });

  describe('getApplicationRatingsBySlug', () => {
    it('should return empty ratings for an application with no ratings', async () => {
      const result = await service.getApplicationRatingBySlug('ratings-app-one');

      expect(result.applicationSlug).toBe('ratings-app-one');
      expect(result.ratings).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.averageScore).toBe(0);
    });
  });

  describe('createRatingByApplicationSlug', () => {
    it('should create a rating for an application', async () => {
      const created = await service.createRatingByApplicationSlug('ratings-app-one', firstUser.id, {
        score: 4.5,
        comment: 'Great app',
        isAnonymous: false,
      });

      expect(created.applicationId).toBeGreaterThan(0);
      expect(created.score).toBe(4.5);
      expect(created.comment).toBe('Great app');
      expect(created.isAnonymous).toBe(false);
      expect(created.userEmail).toBe(firstUser.email);

      const list = await service.getApplicationRatingBySlug('ratings-app-one');
      expect(list.total).toBe(1);
      expect(list.averageScore).toBe(4.5);
    });

    it('should throw 409 when user already rated the same application', async () => {
      await service.createRatingByApplicationSlug('ratings-app-one', firstUser.id, {
        score: 4,
      });

      await expect(
        service.createRatingByApplicationSlug('ratings-app-one', firstUser.id, {
          score: 3,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_RATING',
      });
    });

    it('should throw 404 when the user does not exist', async () => {
      await expect(
        service.createRatingByApplicationSlug('ratings-app-one', 'missing-user-id', {
          score: 4,
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('should throw 404 when the application does not exist', async () => {
      await expect(
        service.createRatingByApplicationSlug('missing-app', firstUser.id, {
          score: 4,
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('patchRatingByApplicationSlug', () => {
    it('should update an existing rating owned by the user', async () => {
      const created = await service.createRatingByApplicationSlug('ratings-app-one', firstUser.id, {
        score: 2,
        comment: 'Initial comment',
      });

      const updated = await service.patchRatingByApplicationSlug('ratings-app-one', firstUser.id, {
        score: 5,
        comment: 'Updated comment',
        isAnonymous: true,
      });

      expect(updated.applicationId).toBe(created.applicationId);
      expect(updated.score).toBe(5);
      expect(updated.comment).toBe('Updated comment');
      expect(updated.isAnonymous).toBe(true);
      expect(updated.userEmail).toBeNull();
    });

    it('should throw 404 when user has no rating for the application', async () => {
      await service.createRatingByApplicationSlug('ratings-app-one', firstUser.id, {
        score: 3,
      });

      await expect(
        service.patchRatingByApplicationSlug('ratings-app-one', secondUser.id, { score: 1 }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('deleteRatingByApplicationSlug', () => {
    it('should delete a rating owned by the user', async () => {
      const created = await service.createRatingByApplicationSlug('ratings-app-one', firstUser.id, {
        score: 4,
      });

      const deleted = await service.deleteRatingByApplicationSlug('ratings-app-one', firstUser.id);

      expect(deleted.applicationId).toBe(created.applicationId);

      const list = await service.getApplicationRatingBySlug('ratings-app-one');
      expect(list.total).toBe(0);
      expect(list.averageScore).toBe(0);
    });

    it('should throw 404 when user has no rating for the application', async () => {
      await service.createRatingByApplicationSlug('ratings-app-one', firstUser.id, {
        score: 4,
      });

      await expect(
        service.deleteRatingByApplicationSlug('ratings-app-one', secondUser.id),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('should get all ratings only by a single user', async () => {
      await service.createRatingByApplicationSlug('ratings-app-one', firstUser.id, {
        score: 4,
      })
      await service.createRatingByApplicationSlug('ratings-app-two', firstUser.id, {
        score: 4,
      })

      await service.createRatingByApplicationSlug('ratings-app-two', secondUser.id, {
        score: 4,
      })
      
      const ratings = await service.getRatingByUserId(firstUser.id)
      

      expect(ratings.length).toBe(2)
    })
  });
});
