import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { s3 } from '@/shared/infrastructure/s3/client.js';
import { requireAuth } from '@/shared/middleware/auth.middleware.js';
import { HttpError } from '@/shared/middleware/error.middleware.js';
import { S3ImageQuerySchema, S3PresignedUploadQuerySchema } from './dto/index.js';
import { and, eq, or, sql } from 'drizzle-orm';
import { application } from '@/shared/infrastructure/database/schema.js';
import { db } from '@/shared/config/database.js';

const router = Router();

const ALLOWED_PREFIXES = ['preview-images/', 'icons/'];

const contentTypeToExt: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

router.get(
  '/uploads/presigned',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { contentType, type } = S3PresignedUploadQuerySchema.parse(req.query);

    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new HttpError(500, 'Server misconfigured', 'INTERNAL_ERROR');
    }

    const ext = contentTypeToExt[contentType] ?? 'jpg';
    const prefix = type === 'icon' ? 'icons' : 'preview-images';
    const key = `${prefix}/${Date.now()}-${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    res.status(200).json({ presignedUrl, key });
  },
);

router.get('/signed', async (req: Request, res: Response): Promise<void> => {
  const { key } = S3ImageQuerySchema.parse(req.query);

  if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
    throw new HttpError(400, 'Invalid key', 'INVALID_KEY');
  }

  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new HttpError(500, 'Server misconfigured', 'INTERNAL_ERROR');
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

  res
    .status(307)
    .set({
      Location: signedUrl,
      'Cache-Control': 'public, max-age=3600',
    })
    .end();
});

router.delete('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { key } = S3ImageQuerySchema.parse(req.query);

  if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
    throw new HttpError(400, 'Invalid key', 'INVALID_KEY');
  }

  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new HttpError(500, 'Server misconfigured', 'INTERNAL_ERROR');
  }

  const actorUserId = res.locals.authUserId as string;
  const actorRole = res.locals.authUserRole as string;

  if (actorRole !== 'admin') {
    const [ownedApplication] = await db
      .select({ id: application.id })
      .from(application)
      .where(
        and(
          eq(application.userId, actorUserId),
          or(
            eq(application.icon, key),
            sql`${key} = ANY(${application.previewImages})`,
          ),
        ),
      )
      .limit(1);

    if (!ownedApplication) {
      throw new HttpError(403, 'Forbidden', 'FORBIDDEN');
    }
  }

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await s3.send(command);

  res.status(204).send();
});

export default router;
