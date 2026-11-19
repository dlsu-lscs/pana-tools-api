import type { Request, Response, NextFunction } from 'express';
import { HttpError } from './error.middleware.js';

interface RateLimitRecord {
  timestamp: number;
}

const viewRateLimitStore = new Map<string, RateLimitRecord>();

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
  const windowMs = 60 * 1000;

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

const feedbackRateLimitStore = new Map<string, number[]>();

const feedbackCleanupInterval = setInterval(() => {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  for (const [key, timestamps] of feedbackRateLimitStore.entries()) {
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length === 0) {
      feedbackRateLimitStore.delete(key);
    } else {
      feedbackRateLimitStore.set(key, valid);
    }
  }
}, 5 * 60 * 1000);

feedbackCleanupInterval.unref();

/**
 * Enforces a sliding 1-hour window rate limit allowing a maximum of 5 feedback submissions per IP,
 * rejecting excess requests with a 429 HttpError to prevent automated spam while keeping error responses safe.
 */
export const rateLimitFeedback = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;

  const timestamps = feedbackRateLimitStore.get(ip) || [];
  const recentTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (recentTimestamps.length >= 5) {
    throw new HttpError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED');
  }

  recentTimestamps.push(now);
  feedbackRateLimitStore.set(ip, recentTimestamps);
  next();
};

/**
 * Resets the in-memory feedback submission rate limit tracker to allow clean test isolation.
 */
export const _clearFeedbackRateLimitStore = (): void => {
  feedbackRateLimitStore.clear();
};
