import type { Request, Response, NextFunction } from 'express';
import { HttpError } from './error.middleware.js';

interface RateLimitRecord {
  timestamp: number;
}

const viewRateLimitStore = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const windowMs = 60 * 1000;
  for (const [key, record] of viewRateLimitStore.entries()) {
    if (now - record.timestamp > windowMs) {
      viewRateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

cleanupInterval.unref();

export const rateLimitViewIncrement = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const slug = req.params.slug;
  const key = `${ip}:${slug}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute per IP per app

  const record = viewRateLimitStore.get(key);
  if (record && now - record.timestamp < windowMs) {
    throw new HttpError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED');
  }

  viewRateLimitStore.set(key, { timestamp: now });
  next();
};

export const _clearViewRateLimitStore = (): void => {
  viewRateLimitStore.clear();
};