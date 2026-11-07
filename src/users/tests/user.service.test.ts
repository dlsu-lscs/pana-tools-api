import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import UserService from '../user.service.js';
import { user } from '../user.model.js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestDatabase } from '@/shared/config/test-database.js';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';

describe('UserService', () => {
  let service: UserService;
  let db: PgliteDatabase;
  let client: PGlite;

  const testUserId1 = 'user-1-id';
  const testUserEmail1 = 'user1@example.com';
  const testUserId2 = 'user-2-id';
  const testUserEmail2 = 'user2@example.com';
  const adminUserId = 'admin-user-id';
  const adminUserEmail = 'admin@example.com';

  beforeAll(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db as unknown as PgliteDatabase;
    client = testDb.client;

    service = new UserService(db as unknown as NodePgDatabase);
  });

  beforeEach(async () => {
    await db.delete(user);
    await db.insert(user).values([
      {
        id: testUserId1,
        name: 'User One',
        email: testUserEmail1,
        emailVerified: true,
        role: 'user',
        tosAccepted: false,
        tosAcceptedAt: null,
      },
      {
        id: testUserId2,
        name: 'User Two',
        email: testUserEmail2,
        emailVerified: true,
        role: 'user',
        tosAccepted: false,
        tosAcceptedAt: null,
      },
      {
        id: adminUserId,
        name: 'Admin User',
        email: adminUserEmail,
        emailVerified: true,
        role: 'admin',
        tosAccepted: false,
        tosAcceptedAt: null,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(user);
    await client.close();
  });

  describe('acceptTos', () => {
    it('should successfully update tosAccepted and tosAcceptedAt for the authenticated user', async () => {
      const result = await service.acceptTos(testUserEmail1, testUserId1);

      expect(result.email).toBe(testUserEmail1);
      expect(result.tosAccepted).toBe(true);
      expect(result.tosAcceptedAt).toBeInstanceOf(Date);

      // Verify in DB
      const [inDb] = await db.select().from(user).where(eq(user.id, testUserId1)).limit(1);
      expect(inDb.tosAccepted).toBe(true);
      expect(inDb.tosAcceptedAt).not.toBeNull();
    });

    it('should be idempotent when called multiple times', async () => {
      const firstResult = await service.acceptTos(testUserEmail1, testUserId1);
      expect(firstResult.tosAccepted).toBe(true);
      const firstTimestamp = firstResult.tosAcceptedAt?.getTime();

      // Second call
      const secondResult = await service.acceptTos(testUserEmail1, testUserId1);
      expect(secondResult.tosAccepted).toBe(true);
      expect(secondResult.tosAcceptedAt?.getTime()).toBe(firstTimestamp);

      // Verify in DB
      const [inDb] = await db.select().from(user).where(eq(user.id, testUserId1)).limit(1);
      expect(inDb.tosAccepted).toBe(true);
      expect(inDb.tosAcceptedAt?.getTime()).toBe(firstTimestamp);
    });

    it('should throw 403 Forbidden when a user tries to accept TOS for another user', async () => {
      await expect(
        service.acceptTos(testUserEmail1, testUserId2),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });

      // Verify target user in DB was NOT updated
      const [inDb] = await db.select().from(user).where(eq(user.id, testUserId1)).limit(1);
      expect(inDb.tosAccepted).toBe(false);
      expect(inDb.tosAcceptedAt).toBeNull();
    });

    it('should throw 403 Forbidden when an admin tries to accept TOS on behalf of another user', async () => {
      await expect(
        service.acceptTos(testUserEmail2, adminUserId),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });

      // Verify target user in DB was NOT updated
      const [inDb] = await db.select().from(user).where(eq(user.id, testUserId2)).limit(1);
      expect(inDb.tosAccepted).toBe(false);
      expect(inDb.tosAcceptedAt).toBeNull();
    });

    it('should throw 404 Not Found when email does not exist', async () => {
      await expect(
        service.acceptTos('nonexistent@example.com', testUserId1),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });
});
