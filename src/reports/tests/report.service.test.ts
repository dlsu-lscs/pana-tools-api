import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PGlite } from '@electric-sql/pglite';
import { createTestDatabase } from '@/shared/config/test-database.js';
import ReportService from '../report.service.js';
import { application, rating, report, user } from '../report.model.js';

describe('ReportService', () => {
  let service: ReportService;
  let db: PgliteDatabase;
  let client: PGlite;

  const firstUser = {
    id: 'report-user-1',
    email: 'report-user-1@example.com',
    name: 'Report User One',
  };

  const secondUser = {
    id: 'report-user-2',
    email: 'report-user-2@example.com',
    name: 'Report User Two',
  };

  const adminUser = {
    id: 'report-admin-1',
    email: 'report-admin@example.com',
    name: 'Report Admin',
  };

  let appId: number;
  let ratingId: number;

  beforeAll(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db as unknown as PgliteDatabase;
    client = testDb.client;

    service = new ReportService(db as unknown as NodePgDatabase);

    // Seed users
    await db.insert(user).values([
      {
        id: firstUser.id,
        name: firstUser.name,
        email: firstUser.email,
      },
      {
        id: secondUser.id,
        name: secondUser.name,
        email: secondUser.email,
      },
      {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
      },
    ]);

    // Seed application owned by firstUser
    const [insertedApp] = await db
      .insert(application)
      .values({
        title: 'Report Test App',
        slug: 'report-test-app',
        userId: firstUser.id,
        status: 'APPROVED',
        githubLink: 'https://github.com/user/repo',
        rejectionReason: null,
      })
      .returning({ id: application.id });
    appId = insertedApp.id;

    // Seed a rating/review by secondUser on the app
    const [insertedRating] = await db
      .insert(rating)
      .values({
        userId: secondUser.id,
        applicationId: appId,
        score: 4.5,
        comment: 'Great app!',
        isAnonymous: false,
      })
      .returning({ id: rating.id });
    ratingId = insertedRating.id;
  });

  afterEach(async () => {
    await db.delete(report);
  });

  afterAll(async () => {
    await client.close();
  });

  describe('createReport', () => {
    it('should create a report for an application', async () => {
      const created = await service.createReport(secondUser.id, {
        targetType: 'application',
        targetId: appId,
        reason: 'spam',
        description: 'This is spam content',
      });

      expect(created.id).toBeGreaterThan(0);
      expect(created.reporterId).toBe(secondUser.id);
      expect(created.targetType).toBe('application');
      expect(created.targetId).toBe(appId);
      expect(created.reason).toBe('spam');
      expect(created.description).toBe('This is spam content');
      expect(created.status).toBe('pending');
      expect(created.adminNote).toBeNull();
      expect(created.reviewedBy).toBeNull();
    });

    it('should create a report for a review', async () => {
      const created = await service.createReport(firstUser.id, {
        targetType: 'review',
        targetId: ratingId,
        reason: 'offensive',
      });

      expect(created.id).toBeGreaterThan(0);
      expect(created.targetType).toBe('review');
      expect(created.targetId).toBe(ratingId);
      expect(created.reason).toBe('offensive');
    });

    it('should throw 404 when application target does not exist', async () => {
      await expect(
        service.createReport(secondUser.id, {
          targetType: 'application',
          targetId: 99999,
          reason: 'spam',
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('should throw 404 when review target does not exist', async () => {
      await expect(
        service.createReport(firstUser.id, {
          targetType: 'review',
          targetId: 99999,
          reason: 'spam',
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('should throw 403 when trying to report own application', async () => {
      await expect(
        service.createReport(firstUser.id, {
          targetType: 'application',
          targetId: appId,
          reason: 'spam',
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('should throw 403 when trying to report own review', async () => {
      await expect(
        service.createReport(secondUser.id, {
          targetType: 'review',
          targetId: ratingId,
          reason: 'spam',
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('should throw 409 when creating a duplicate report', async () => {
      await service.createReport(secondUser.id, {
        targetType: 'application',
        targetId: appId,
        reason: 'spam',
      });

      await expect(
        service.createReport(secondUser.id, {
          targetType: 'application',
          targetId: appId,
          reason: 'offensive',
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_REPORT',
      });
    });
  });

  describe('checkReport', () => {
    it('should return hasReported: true when report exists', async () => {
      await service.createReport(secondUser.id, {
        targetType: 'application',
        targetId: appId,
        reason: 'spam',
      });

      const result = await service.checkReport(secondUser.id, 'application', appId);

      expect(result.hasReported).toBe(true);
      expect(result.report).toBeDefined();
      expect(result.report?.targetType).toBe('application');
      expect(result.report?.targetId).toBe(appId);
    });

    it('should return hasReported: false when no report exists', async () => {
      const result = await service.checkReport(secondUser.id, 'application', appId);

      expect(result.hasReported).toBe(false);
      expect(result.report).toBeNull();
    });
  });

  describe('getAdminReports', () => {
    it('should return all reports with pagination', async () => {
      await service.createReport(secondUser.id, {
        targetType: 'application',
        targetId: appId,
        reason: 'spam',
      });

      const result = await service.getAdminReports({ page: 1, limit: 20 });

      expect(result.reports.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.reports[0].reporterEmail).toBe(secondUser.email);
      expect(result.reports[0].reporterName).toBe(secondUser.name);
    });

    it('should filter reports by status', async () => {
      await service.createReport(secondUser.id, {
        targetType: 'application',
        targetId: appId,
        reason: 'spam',
      });

      const pending = await service.getAdminReports({ status: 'pending', page: 1, limit: 20 });
      expect(pending.total).toBe(1);

      const resolved = await service.getAdminReports({ status: 'resolved', page: 1, limit: 20 });
      expect(resolved.total).toBe(0);
    });

    it('should filter reports by targetType', async () => {
      await service.createReport(secondUser.id, {
        targetType: 'application',
        targetId: appId,
        reason: 'spam',
      });

      const appReports = await service.getAdminReports({ targetType: 'application', page: 1, limit: 20 });
      expect(appReports.total).toBe(1);

      const reviewReports = await service.getAdminReports({ targetType: 'review', page: 1, limit: 20 });
      expect(reviewReports.total).toBe(0);
    });
  });

  describe('updateReport', () => {
    it('should update report status and admin note', async () => {
      const created = await service.createReport(secondUser.id, {
        targetType: 'application',
        targetId: appId,
        reason: 'spam',
      });

      const updated = await service.updateReport(created.id, adminUser.id, {
        status: 'resolved',
        adminNote: 'Confirmed spam, content removed.',
      });

      expect(updated.id).toBe(created.id);
      expect(updated.status).toBe('resolved');
      expect(updated.adminNote).toBe('Confirmed spam, content removed.');
      expect(updated.reviewedBy).toBe(adminUser.id);
    });

    it('should throw 404 when updating a non-existent report', async () => {
      await expect(
        service.updateReport(99999, adminUser.id, {
          status: 'resolved',
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('deleteReport', () => {
    it('should delete a report', async () => {
      const created = await service.createReport(secondUser.id, {
        targetType: 'application',
        targetId: appId,
        reason: 'spam',
      });

      await service.deleteReport(created.id);

      // Verify deletion
      const result = await service.getAdminReports({ page: 1, limit: 20 });
      expect(result.total).toBe(0);
    });

    it('should throw 404 when deleting a non-existent report', async () => {
      await expect(service.deleteReport(99999)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });
});
