import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import FavoritesService from '../favorites.service.js';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { createTestDatabase } from '@/shared/config/test-database.js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { application, user, userFavorite } from '../favorites.model.js';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let db: PgliteDatabase;
  let client: PGlite;
  let firstApplicationId: number;
  let secondApplicationId: number;

  const firstUserId = 'test-user-1';
  const secondUserId = 'test-user-2';

  beforeAll(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db as unknown as PgliteDatabase;
    client = testDb.client;

    await db.insert(user).values([
      {
        id: firstUserId,
        name: 'Test User One',
        email: 'test-user-one@gmail.com',
        emailVerified: true,
      },
      {
        id: secondUserId,
        name: 'Test User Two',
        email: 'test-user-two@gmail.com',
        emailVerified: true,
      },
    ]);

    await db.insert(application).values([
      {
        title: 'Test App 1',
        slug: 'test-app-1',
        userId: firstUserId,
        status: 'APPROVED',
        rejectionReason: null,
        githubLink: 'https://github.com/user/repo',
      },
      {
        title: 'Test App 2',
        slug: 'test-app-2',
        userId: firstUserId,
        status: 'APPROVED',
        rejectionReason: null,
        githubLink: 'https://github.com/user/repo',
      },
    ]);

    service = new FavoritesService(db as NodePgDatabase);

    const seededApplications = await db
      .select({ id: application.id, slug: application.slug })
      .from(application);

    const firstApplication = seededApplications.find(
      (seededApplication) => seededApplication.slug === 'test-app-1',
    );
    const secondApplication = seededApplications.find(
      (seededApplication) => seededApplication.slug === 'test-app-2',
    );

    if (!firstApplication || !secondApplication) {
      throw new Error('Failed to seed expected test applications.');
    }

    firstApplicationId = firstApplication.id;
    secondApplicationId = secondApplication.id;
  });

  afterEach(async () => {
    await db.delete(userFavorite);
  });

  afterAll(async () => {
    await client.close();
  });

  describe('createFavorite', () => {
    it('should create a favorite', async () => {
      await service.createFavorite({
        userId: firstUserId,
        applicationId: firstApplicationId,
      });

      const favorites = await service.getUserFavorite(firstUserId);
      expect(favorites).toEqual([firstApplicationId]);
    });

    it('should throw 409 when favorite already exists', async () => {
      await service.createFavorite({
        userId: firstUserId,
        applicationId: firstApplicationId,
      });

      await expect(
        service.createFavorite({
          userId: firstUserId,
          applicationId: firstApplicationId,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_FAVORITE',
      });
    });

    it('should throw 404 when user does not exist', async () => {
      await expect(
        service.createFavorite({
          userId: 'missing-user-id',
          applicationId: firstApplicationId,
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('should throw 404 when application does not exist', async () => {
      await expect(
        service.createFavorite({
          userId: firstUserId,
          applicationId: 999999,
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('getUserFavorites', () => {
    it('should return empty array if no favorites', async () => {
      const favorites = await service.getUserFavorite(firstUserId);
      expect(favorites).toEqual([]);
    });

    it('should return all application ids the user favorited', async () => {
      await service.createFavorite({
        userId: firstUserId,
        applicationId: firstApplicationId,
      });
      await service.createFavorite({
        userId: firstUserId,
        applicationId: secondApplicationId,
      });

      const favorites = await service.getUserFavorite(firstUserId);

      expect(favorites).toHaveLength(2);
      expect(favorites).toEqual(expect.arrayContaining([firstApplicationId, secondApplicationId]));
    });
  });

  describe('getApplicationFavorites', () => {
    it('should return all users who favorited an application', async () => {
      await service.createFavorite({
        userId: firstUserId,
        applicationId: firstApplicationId,
      });
      await service.createFavorite({
        userId: secondUserId,
        applicationId: firstApplicationId,
      });

      const favorites = await service.getApplicationFavorites(firstApplicationId);

      expect(favorites).toHaveLength(2);
      expect(favorites).toEqual(expect.arrayContaining([firstUserId, secondUserId]));
    });
  });

  describe('getApplicationFavoritesCount', () => {
    it('should return 0 when no users favorited an application', async () => {
      const count = await service.getApplicationFavoritesCount(firstApplicationId);
      expect(count).toBe(0);
    });

    it('should return the total number of users who favorited an application', async () => {
      await service.createFavorite({
        userId: firstUserId,
        applicationId: firstApplicationId,
      });
      await service.createFavorite({
        userId: secondUserId,
        applicationId: firstApplicationId,
      });
      await service.createFavorite({
        userId: firstUserId,
        applicationId: secondApplicationId,
      });

      const count = await service.getApplicationFavoritesCount(firstApplicationId);
      expect(count).toBe(2);
    });
  });

  describe('deleteFavorite', () => {
    it('should delete a favorite', async () => {
      await service.createFavorite({
        userId: firstUserId,
        applicationId: firstApplicationId,
      });

      const deletedFavorite = await service.deleteFavorite(firstUserId, firstApplicationId);

      expect(deletedFavorite).toEqual({
        userId: firstUserId,
        applicationId: firstApplicationId,
      });

      const favorites = await service.getUserFavorite(firstUserId);
      expect(favorites).toEqual([]);
    });

    it('should throw 404 when deleting a non-existing favorite', async () => {
      await expect(service.deleteFavorite(firstUserId, firstApplicationId)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });
});
