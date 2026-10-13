import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import ApplicationService from '../application.service.js';
import { HttpError } from '@/shared/middleware/error.middleware.js';
import { application, user } from '../application.model.js';
import type { InsertApplication } from '../application.model.js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestDatabase } from '@/shared/config/test-database.js';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { userFavorite } from '@/favorites/favorites.model.js';
import { rating } from '@/ratings/rating.model.js';

describe('ApplicationService', () => {
  let service: ApplicationService;
  let db: PgliteDatabase;
  let client: PGlite;
  const testUserId = 'app-favorites-user';
  const otherUserId = 'app-other-user';

  beforeAll(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db as unknown as PgliteDatabase;
    client = testDb.client;

    service = new ApplicationService(db as NodePgDatabase);

    await db.insert(user).values([
      {
        id: testUserId,
        name: 'Application Favorites User',
        email: 'application-favorites-user@example.com',
        emailVerified: true,
        tosAccepted: true,
      },
      {
        id: otherUserId,
        name: 'Other Application User',
        email: 'other-application-user@example.com',
        emailVerified: true,
        tosAccepted: true,
      },
    ]);
  });

  afterEach(async () => {
    await db.delete(userFavorite);
    await db.delete(application);
  });

  afterAll(async () => {
    await db.delete(userFavorite);
    await db.delete(application);
    await db.delete(user).where(eq(user.id, testUserId));
    await db.delete(user).where(eq(user.id, otherUserId));
    await client.close();
  });

  const createTestApp = async (overrides: Partial<InsertApplication> = {}) => {
    const [created] = await db
      .insert(application)
      .values({
        slug: `test-app-${Math.random().toString(36).substring(7)}`,
        title: 'Test Application',
        description: 'A test application',
        githubLink: 'https://github.com/test/test-app',
        tags: ['test'],
        userId: testUserId,
        status: 'APPROVED',
        rejectionReason: null,
        ...overrides,
      })
      .returning();
    return created;
  };

  describe('getPaginatedApplications', () => {
    it('should throw error when limit is less than 1', async () => {
      await expect(service.getPaginatedApplications(0, 1)).rejects.toThrow(HttpError);
    });

    it('should throw error when page is less than 1', async () => {
      await expect(service.getPaginatedApplications(10, 0)).rejects.toThrow(HttpError);
    });

    it('should return paginated applications with correct structure', async () => {
      await createTestApp({ slug: 'app-1' });
      await createTestApp({ slug: 'app-2' });

      const result = await service.getPaginatedApplications(2, 1);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.data[0]).toHaveProperty('userEmail');
    });

    it('should include favoritesCount for each application', async () => {
      const firstApp = await createTestApp({ slug: 'favorite-count-app-1' });
      const secondApp = await createTestApp({ slug: 'favorite-count-app-2' });

      await db.insert(userFavorite).values({
        userId: testUserId,
        applicationId: firstApp.id,
      });

      const result = await service.getPaginatedApplications(10, 1);

      const first = result.data.find((app) => app.id === firstApp.id);
      const second = result.data.find((app) => app.id === secondApp.id);

      expect(first?.favoritesCount).toBe(1);
      expect(second?.favoritesCount).toBe(0);
    });

    it('should filter by createdAfter only', async () => {
      await createTestApp({ slug: 'created-after-old', createdAt: new Date('2020-01-01') });
      await createTestApp({ slug: 'created-after-new', createdAt: new Date('2024-01-01') });

      const result = await service.getPaginatedApplications(10, 1, {
        createdAfter: new Date('2023-01-01'),
      });

      expect(result.meta.total).toBe(1);
      expect(result.data[0].slug).toBe('created-after-new');
    });

    it('should filter by createdBefore only', async () => {
      await createTestApp({ slug: 'created-before-old', createdAt: new Date('2020-01-01') });
      await createTestApp({ slug: 'created-before-new', createdAt: new Date('2024-01-01') });

      const result = await service.getPaginatedApplications(10, 1, {
        createdBefore: new Date('2021-01-01'),
      });

      expect(result.meta.total).toBe(1);
      expect(result.data[0].slug).toBe('created-before-old');
    });

    it('should filter by search and tags together', async () => {
      await createTestApp({
        slug: 'combo-match',
        title: 'Combo Match App',
        tags: ['combo'],
      });
      await createTestApp({
        slug: 'combo-title-only',
        title: 'Combo Match App',
        tags: ['other'],
      });
      await createTestApp({
        slug: 'combo-tag-only',
        title: 'Other Title',
        tags: ['combo'],
      });

      const result = await service.getPaginatedApplications(10, 1, {
        search: 'Combo Match',
        tags: ['combo'],
      });

      expect(result.meta.total).toBe(1);
      expect(result.data[0].slug).toBe('combo-match');
    });

    it('should cap limit at MAX_LIMIT', async () => {
      // Insert 105 apps
      const apps = Array.from({ length: 105 }).map((_, i) => ({
        slug: `limit-test-${i}`,
        title: `App ${i}`,
        description: 'desc',
        githubLink: 'https://github.com/test/test-app',
        tags: [],
        userId: testUserId,
        status: 'APPROVED' as const,
        rejectionReason: null,
      }));
      await db.insert(application).values(apps);

      // Request 500, but MAX_LIMIT is 100
      const result = await service.getPaginatedApplications(500, 1);

      expect(result.data).toHaveLength(100);
      expect(result.meta.total).toBe(105);
    });

    it('should calculate correct offset for pagination', async () => {
      for (let i = 0; i < 15; i++) {
        await createTestApp({
          slug: `offset-test-${i}`,
          title: `App ${i.toString().padStart(2, '0')}`,
        });
      }

      // Sort by title ASC to be deterministic: App 00, App 01, ... App 14
      // Page 2 with limit 5 should give App 05 to App 09
      const result = await service.getPaginatedApplications(5, 2, {
        sortBy: 'title',
        sortOrder: 'asc',
      });

      expect(result.data).toHaveLength(5);
      expect(result.data[0].title).toBe('App 05');
      expect(result.data[4].title).toBe('App 09');
    });

    it('should only return approved applications', async () => {
      await createTestApp({ slug: 'approved-app', status: 'APPROVED' });
      await createTestApp({ slug: 'pending-app', status: 'PENDING' });

      const result = await service.getPaginatedApplications(10, 1);

      expect(result.data.some((app) => app.slug === 'approved-app')).toBe(true);
      expect(result.data.some((app) => app.slug === 'pending-app')).toBe(false);
    });
  });

  describe('getApplicationBySlug', () => {
    it('should return application when found', async () => {
      const created = await createTestApp({ slug: 'test-slug' });
      const result = await service.getApplicationBySlug('test-slug');
      expect(result.id).toBe(created.id);
    });

    it('should throw 404 when slug exists but application is not approved', async () => {
      await createTestApp({ slug: 'pending-slug', status: 'PENDING' });

      await expect(service.getApplicationBySlug('pending-slug')).rejects.toThrow(HttpError);
    });

    it('should throw 404 when application not found', async () => {
      await expect(service.getApplicationBySlug('nonexistent')).rejects.toThrow(HttpError);
    });
  });

  describe('createApplication', () => {
    it('should create application when slug is unique', async () => {
      const newApp = {
        slug: 'new-unique-app',
        title: 'New Application',
        description: 'A new app',
        url: 'https://example.com/new-unique-app',
        githubLink: 'https://github.com/test/test-app',
        tags: ['new'],
      };

      expect(await service.createApplication(newApp, testUserId)).toBeUndefined();

      // Verify in DB
      const [inDb] = await db.select().from(application).where(eq(application.slug, newApp.slug));
      expect(inDb).toBeDefined();
    });

    it('should throw 409 when slug already exists', async () => {
      await createTestApp({ slug: 'existing-slug' });

      const newApp = {
        slug: 'existing-slug',
        title: 'Duplicate',
        description: 'A new app',
        url: 'https://example.com/existing-slug',
        githubLink: 'https://github.com/test/test-app',
        tags: [],
      };

      await expect(service.createApplication(newApp, testUserId)).rejects.toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_SLUG',
      });
    });

    it('should throw 404 when authenticated user does not exist', async () => {
      const newApp = {
        slug: 'missing-user-app',
        title: 'Missing User',
        description: 'Should fail because authenticated user does not exist',
        url: 'https://example.com/missing-user-app',
        githubLink: 'https://github.com/test/test-app',
        tags: [],
      };

      await expect(service.createApplication(newApp, 'missing-user-id')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('should throw 403 when user has not accepted TOS', async () => {
      const noTosUserId = 'no-tos-user';
      await db.insert(user).values({
        id: noTosUserId,
        name: 'No TOS User',
        email: 'no-tos@example.com',
        emailVerified: true,
        tosAccepted: false,
      });

      const newApp = {
        slug: 'tos-blocked-app',
        title: 'TOS Blocked',
        description: 'Should fail because TOS not accepted',
        url: 'https://example.com/tos-blocked',
        githubLink: 'https://github.com/test/test-app',
        tags: [],
      };

      await expect(service.createApplication(newApp, noTosUserId)).rejects.toMatchObject({
        statusCode: 403,
        code: 'TOS_NOT_ACCEPTED',
      });

      // Cleanup
      await db.delete(user).where(eq(user.id, noTosUserId));
    });
  });

  describe('deleteApplicationById', () => {
    it('should soft-delete application when it exists', async () => {
      const app = await createTestApp();

      expect(await service.deleteApplicationById(app.id, testUserId)).toBeUndefined();

      // Verify in DB that it is soft-deleted
      const [inDb] = await db.select().from(application).where(eq(application.id, app.id));
      expect(inDb).toBeDefined();
      expect(inDb.status).toBe('REMOVED');
      expect(inDb.rejectionReason).toBe('Deleted by owner');
    });

    it('should throw 404 when application not found', async () => {
      await expect(service.deleteApplicationById(99999, testUserId)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it("should throw 403 when deleting another user's application", async () => {
      const app = await createTestApp({ userId: otherUserId });

      await expect(service.deleteApplicationById(app.id, testUserId)).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });
  });

  describe('reviewAdminApplicationById', () => {
    it('should approve a pending application and clear rejection reason', async () => {
      const app = await createTestApp({
        status: 'PENDING',
        rejectionReason: 'legacy reason',
      });

      await service.reviewAdminApplicationById(app.id, {
        status: 'APPROVED',
        rejectionReason: null,
      });

      const [reviewed] = await db.select().from(application).where(eq(application.id, app.id));

      expect(reviewed.status).toBe('APPROVED');
      expect(reviewed.rejectionReason).toBeNull();
    });

    it('should request changes on a pending application with a reason', async () => {
      const app = await createTestApp({ status: 'PENDING' });

      await service.reviewAdminApplicationById(app.id, {
        status: 'CHANGES_REQUESTED',
        rejectionReason: 'Missing details',
      });

      const [reviewed] = await db.select().from(application).where(eq(application.id, app.id));

      expect(reviewed.status).toBe('CHANGES_REQUESTED');
      expect(reviewed.rejectionReason).toBe('Missing details');
    });

    it('should approve a changes-requested application when admin changes mind', async () => {
      const app = await createTestApp({
        status: 'CHANGES_REQUESTED',
        rejectionReason: 'Initial rejection',
      });

      await service.reviewAdminApplicationById(app.id, {
        status: 'APPROVED',
        rejectionReason: null,
      });

      const [reviewed] = await db.select().from(application).where(eq(application.id, app.id));

      expect(reviewed.status).toBe('APPROVED');
      expect(reviewed.rejectionReason).toBeNull();
    });

    it('should remove an approved application during admin review', async () => {
      const app = await createTestApp({
        status: 'APPROVED',
        rejectionReason: null,
      });

      await service.reviewAdminApplicationById(app.id, {
        status: 'REMOVED',
        rejectionReason: 'Removed after admin review',
      });

      const [reviewed] = await db.select().from(application).where(eq(application.id, app.id));

      expect(reviewed.status).toBe('REMOVED');
      expect(reviewed.rejectionReason).toBe('Removed after admin review');
    });

    it('should throw 400 when requesting changes without a reason', async () => {
      const app = await createTestApp({ status: 'PENDING' });

      await expect(
        service.reviewAdminApplicationById(app.id, {
          status: 'CHANGES_REQUESTED',
          rejectionReason: null,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('should throw 400 when removing without rejection reason', async () => {
      const app = await createTestApp({ status: 'APPROVED' });

      await expect(
        service.reviewAdminApplicationById(app.id, {
          status: 'REMOVED',
          rejectionReason: null,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('should throw 400 when approving with non-null rejection reason', async () => {
      const app = await createTestApp({ status: 'PENDING' });

      await expect(
        service.reviewAdminApplicationById(app.id, {
          status: 'APPROVED',
          rejectionReason: 'should be null',
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('should throw 409 when approved application is reviewed to non-removed status', async () => {
      const app = await createTestApp({ status: 'APPROVED' });

      await expect(
        service.reviewAdminApplicationById(app.id, {
          status: 'CHANGES_REQUESTED',
          rejectionReason: 'late change request',
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'INVALID_APPLICATION_STATE',
      });
    });

    it('should throw 404 when application is not found', async () => {
      await expect(
        service.reviewAdminApplicationById(99999, {
          status: 'APPROVED',
          rejectionReason: null,
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('patchApplicationById', () => {
    it('should update application when it exists', async () => {
      const app = await createTestApp({ title: 'Old Title' });

      await service.patchApplicationById(app.id, { title: 'New Title' }, testUserId, "user");

      const result = await service.getOwnApplicationBySlug(app.slug, testUserId);

      expect(result.title).toBe('New Title');
      expect(result.status).toBe('PENDING');

      // Verify in DB
      const [inDb] = await db.select().from(application).where(eq(application.id, app.id));
      expect(inDb.title).toBe('New Title');
    });

    it('should throw 404 when application not found', async () => {
      await expect(
        service.patchApplicationById(99999, { title: 'New Title' }, testUserId, "user"),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('should throw 409 when updating to an existing slug', async () => {
      await createTestApp({ slug: 'slug-a' });
      const appB = await createTestApp({ slug: 'slug-b' });

      await expect(
        service.patchApplicationById(appB.id, { slug: 'slug-a' }, testUserId, "user"),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_SLUG',
      });
    });

    it('should allow updating to the same slug', async () => {
      const app = await createTestApp({ slug: 'my-slug', title: 'Old' });

      await service.patchApplicationById(app.id, { slug: 'my-slug', title: 'New' }, testUserId, "user");

      const result = await service.getOwnApplicationBySlug('my-slug', testUserId);

      expect(result.title).toBe('New');
      expect(result.slug).toBe('my-slug');
    });

    it('should allow partial updates', async () => {
      const app = await createTestApp({ title: 'Title', description: 'Desc' });

      await service.patchApplicationById(app.id, { description: 'New Desc' }, testUserId, "user");

      const result = await service.getOwnApplicationBySlug(app.slug, testUserId);

      expect(result.description).toBe('New Desc');
      expect(result.title).toBe('Title');
    });

    it('should reset an approved app to PENDING when the author edits it', async () => {
      const app = await createTestApp({ status: 'APPROVED', title: 'Old' });

      await service.patchApplicationById(app.id, { title: 'New' }, testUserId, "user");

      const [inDb] = await db.select().from(application).where(eq(application.id, app.id));
      expect(inDb.status).toBe('PENDING');
    });

    it('should keep an approved app APPROVED when an admin edits it', async () => {
      const app = await createTestApp({ status: 'APPROVED', title: 'Old' });

      await service.patchApplicationById(app.id, { title: 'New' }, otherUserId, "admin");

      const [inDb] = await db.select().from(application).where(eq(application.id, app.id));
      expect(inDb.title).toBe('New');
      expect(inDb.status).toBe('APPROVED');
    });

    it('should keep a CHANGES_REQUESTED app unchanged when an admin edits it', async () => {
      const app = await createTestApp({ status: 'CHANGES_REQUESTED', title: 'Old' });

      await service.patchApplicationById(app.id, { title: 'New' }, otherUserId, "admin");

      const [inDb] = await db.select().from(application).where(eq(application.id, app.id));
      expect(inDb.status).toBe('CHANGES_REQUESTED');
    });

    it("should throw 403 when updating another user's application", async () => {
      const app = await createTestApp({ title: 'Title', userId: otherUserId });

      await expect(
        service.patchApplicationById(app.id, { title: 'New Title' }, testUserId, "user"),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('should return current application for empty patch', async () => {
      const app = await createTestApp({ title: 'Title' });

      await service.patchApplicationById(app.id, {}, testUserId, "user");

      const result = await service.getApplicationBySlug(app.slug);

      expect(result.id).toBe(app.id);
      expect(result.title).toBe('Title');
    });
  });

  describe('Popularity-Based Sorting', () => {
    it('should sort applications by viewCount ascending and descending', async () => {
      const app1 = await createTestApp({ slug: 'views-1', viewCount: 10 });
      const app2 = await createTestApp({ slug: 'views-2', viewCount: 50 });
      const app3 = await createTestApp({ slug: 'views-3', viewCount: 5 });

      const descResult = await service.getPaginatedApplications(10, 1, {
        sortBy: 'viewCount',
        sortOrder: 'desc',
      });
      expect(descResult.data.map((a) => a.slug)).toEqual([app2.slug, app1.slug, app3.slug]);

      const ascResult = await service.getPaginatedApplications(10, 1, {
        sortBy: 'viewCount',
        sortOrder: 'asc',
      });
      expect(ascResult.data.map((a) => a.slug)).toEqual([app3.slug, app1.slug, app2.slug]);
    });

    it('should sort applications by favoritesCount', async () => {
      const app1 = await createTestApp({ slug: 'favs-1' });
      const app2 = await createTestApp({ slug: 'favs-2' });

      // app2 gets 2 favorites, app1 gets 1 favorite
      await db.insert(userFavorite).values([
        { userId: testUserId, applicationId: app1.id },
        { userId: testUserId, applicationId: app2.id },
        { userId: otherUserId, applicationId: app2.id },
      ]);

      const descResult = await service.getPaginatedApplications(10, 1, {
        sortBy: 'favoritesCount',
        sortOrder: 'desc',
      });
      expect(descResult.data[0].slug).toBe(app2.slug);
      expect(descResult.data[1].slug).toBe(app1.slug);

      const ascResult = await service.getPaginatedApplications(10, 1, {
        sortBy: 'favoritesCount',
        sortOrder: 'asc',
      });
      expect(ascResult.data[0].slug).toBe(app1.slug);
      expect(ascResult.data[1].slug).toBe(app2.slug);
    });

    it('should sort applications by ratingCount and averageRating', async () => {
      const app1 = await createTestApp({ slug: 'rating-1' });
      const app2 = await createTestApp({ slug: 'rating-2' });

      // app1: score 5.0 (1 rating)
      // app2: score 3.0, 4.0 -> average 3.5 (2 ratings)
      await db.insert(rating).values([
        { userId: testUserId, applicationId: app1.id, score: 5.0 },
        { userId: testUserId, applicationId: app2.id, score: 3.0 },
        { userId: otherUserId, applicationId: app2.id, score: 4.0 },
      ]);

      const ratingCountDesc = await service.getPaginatedApplications(10, 1, {
        sortBy: 'ratingCount',
        sortOrder: 'desc',
      });
      expect(ratingCountDesc.data[0].slug).toBe(app2.slug);

      const avgRatingDesc = await service.getPaginatedApplications(10, 1, {
        sortBy: 'averageRating',
        sortOrder: 'desc',
      });
      expect(avgRatingDesc.data[0].slug).toBe(app1.slug);
    });
  });

  describe('incrementViewCount', () => {
    it('should increment view count by 1 for approved applications', async () => {
      const app = await createTestApp({ slug: 'view-target', viewCount: 0 });

      await service.incrementViewCount(app.slug);

      const updated = await service.getApplicationBySlug(app.slug);
      expect(updated.viewCount).toBe(1);

      await service.incrementViewCount(app.slug);
      const updatedAgain = await service.getApplicationBySlug(app.slug);
      expect(updatedAgain.viewCount).toBe(2);
    });

    it('should throw 404 when incrementing views for non-existent app', async () => {
      await expect(service.incrementViewCount('non-existent-app')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('should throw 404 when application is not approved', async () => {
      const pendingApp = await createTestApp({ slug: 'pending-view-app', status: 'PENDING' });

      await expect(service.incrementViewCount(pendingApp.slug)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });
});
