import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

vi.mock('@/shared/config/database.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue(true),
  },
  pool: {},
}));

import FeedbackController from '../feedback.controller.js';
import type { IFeedbackService } from '../feedback.service.js';
import {
  rateLimitFeedback,
  _clearFeedbackRateLimitStore,
} from '@/shared/middleware/rate-limit.middleware.js';
import { requireAuth, requireRole } from '@/shared/middleware/auth.middleware.js';
import * as authConfigModule from '@/shared/auth/auth.config.js';

describe('FeedbackController & Middlewares', () => {
  let controller: FeedbackController;
  let mockService: IFeedbackService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: ReturnType<typeof vi.fn>;
  let responseStatus: ReturnType<typeof vi.fn>;

  const mockDate = new Date('2026-07-14T00:00:00.000Z');
  const mockFeedbackItem = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userId: null,
    email: 'visitor@example.com',
    category: 'bug' as const,
    message: 'Encountered unexpected validation failure on submission.',
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  beforeEach(() => {
    _clearFeedbackRateLimitStore();

    mockService = {
      createFeedback: vi.fn().mockResolvedValue(mockFeedbackItem),
      getFeedback: vi.fn().mockResolvedValue(mockFeedbackItem),
      listFeedback: vi.fn().mockResolvedValue({
        data: [mockFeedbackItem],
        total: 1,
        page: 1,
        limit: 20,
      }),
      deleteFeedback: vi.fn().mockResolvedValue(undefined),
    };

    controller = new FeedbackController(mockService);

    responseJson = vi.fn();
    responseStatus = vi.fn().mockReturnValue({ json: responseJson });

    mockResponse = {
      locals: {},
      status: responseStatus,
    };

    mockRequest = {
      headers: {},
      body: {},
      params: {},
      query: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as unknown as Request['socket'],
    };
  });

  describe('createFeedback', () => {
    it('should create feedback for unauthenticated visitor with userId = null and return 201 Created', async () => {
      vi.spyOn(authConfigModule.auth.api, 'getSession').mockResolvedValue(null);

      mockRequest.body = {
        category: 'bug',
        message: 'Valid feedback message with more than 10 characters.',
        email: 'visitor@example.com',
      };

      await controller.createFeedback(mockRequest as Request, mockResponse as Response);

      expect(mockService.createFeedback).toHaveBeenCalledWith(
        {
          category: 'bug',
          message: 'Valid feedback message with more than 10 characters.',
          email: 'visitor@example.com',
        },
        undefined,
      );
      expect(responseStatus).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockFeedbackItem.id,
          userId: null,
          category: 'bug',
          message: mockFeedbackItem.message,
        }),
      );
    });

    it('should automatically attach userId from authenticated session and return 201 Created', async () => {
      mockResponse.locals = { authUserId: 'verified-user-123' };
      mockRequest.body = {
        category: 'feature_request',
        message: 'Allow dark theme customization in user profile.',
      };

      const authenticatedFeedback = {
        ...mockFeedbackItem,
        userId: 'verified-user-123',
        category: 'feature_request' as const,
        message: 'Allow dark theme customization in user profile.',
      };
      (mockService.createFeedback as ReturnType<typeof vi.fn>).mockResolvedValue(authenticatedFeedback);

      await controller.createFeedback(mockRequest as Request, mockResponse as Response);

      expect(mockService.createFeedback).toHaveBeenCalledWith(
        {
          category: 'feature_request',
          message: 'Allow dark theme customization in user profile.',
          email: null,
        },
        'verified-user-123',
      );
      expect(responseStatus).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'verified-user-123',
        }),
      );
    });

    it('should reject payload when message length is less than 10 characters', async () => {
      mockRequest.body = {
        category: 'bug',
        message: 'Too short',
      };

      await expect(
        controller.createFeedback(mockRequest as Request, mockResponse as Response),
      ).rejects.toBeInstanceOf(ZodError);
    });

    it('should reject payload when message length exceeds 1000 characters', async () => {
      mockRequest.body = {
        category: 'bug',
        message: 'a'.repeat(1001),
      };

      await expect(
        controller.createFeedback(mockRequest as Request, mockResponse as Response),
      ).rejects.toBeInstanceOf(ZodError);
    });

    it('should reject payload with invalid category enum', async () => {
      mockRequest.body = {
        category: 'invalid_category',
        message: 'Valid feedback message with more than 10 characters.',
      };

      await expect(
        controller.createFeedback(mockRequest as Request, mockResponse as Response),
      ).rejects.toBeInstanceOf(ZodError);
    });

    it('should reject payload with invalid email address format', async () => {
      mockRequest.body = {
        category: 'general',
        message: 'Valid feedback message with more than 10 characters.',
        email: 'invalid-email-address',
      };

      await expect(
        controller.createFeedback(mockRequest as Request, mockResponse as Response),
      ).rejects.toBeInstanceOf(ZodError);
    });
  });

  describe('getFeedbackAdmin', () => {
    it('should return feedback in descending chronological order with pagination metadata', async () => {
      mockRequest.query = {
        page: '2',
        limit: '10',
        category: 'bug',
      };

      await controller.getFeedbackAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockService.listFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 10,
          category: 'bug',
          sortOrder: 'desc',
        }),
      );
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Array),
          total: 1,
          page: 1,
          limit: 20,
        }),
      );
    });
  });

  describe('deleteFeedbackAdmin', () => {
    it('should delete feedback and return 200 confirmation', async () => {
      mockRequest.params = { id: 'feedback-id-123' };

      await controller.deleteFeedbackAdmin(mockRequest as Request, mockResponse as Response);

      expect(mockService.deleteFeedback).toHaveBeenCalledWith('feedback-id-123');
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({ message: 'Feedback deleted successfully' });
    });

    it('should throw validation error when feedback id is empty', async () => {
      mockRequest.params = { id: '' };

      await expect(
        controller.deleteFeedbackAdmin(mockRequest as Request, mockResponse as Response),
      ).rejects.toBeInstanceOf(ZodError);
    });
  });

  describe('Role-based Access Control', () => {
    it('should return 403 Forbidden when a non-admin user attempts admin route', () => {
      mockResponse.locals = {
        authUserId: 'user-1',
        authUserRole: 'user',
      };

      const middleware = requireRole('admin');
      const nextFn = vi.fn();

      expect(() =>
        middleware(mockRequest as Request, mockResponse as Response, nextFn as NextFunction),
      ).toThrowError(
        expect.objectContaining({
          statusCode: 403,
          code: 'FORBIDDEN',
        }),
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should allow admin user to proceed to admin route', () => {
      mockResponse.locals = {
        authUserId: 'admin-1',
        authUserRole: 'admin',
      };

      const middleware = requireRole('admin');
      const nextFn = vi.fn();

      middleware(mockRequest as Request, mockResponse as Response, nextFn as NextFunction);
      expect(nextFn).toHaveBeenCalled();
    });

    it('should throw 401 Unauthorized when session is missing in requireAuth', async () => {
      vi.spyOn(authConfigModule.auth.api, 'getSession').mockResolvedValue(null);
      const nextFn = vi.fn();

      await expect(
        requireAuth(mockRequest as Request, mockResponse as Response, nextFn as NextFunction),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiter Middleware', () => {
    it('should allow up to 5 feedback submissions per IP in a rolling 1-hour window', () => {
      const nextFn = vi.fn();
      (mockRequest as Record<string, unknown>).ip = '192.168.1.100';

      for (let i = 0; i < 5; i++) {
        rateLimitFeedback(mockRequest as Request, mockResponse as Response, nextFn as NextFunction);
      }

      expect(nextFn).toHaveBeenCalledTimes(5);
    });

    it('should reject with 429 RATE_LIMITED when exceeding 5 submissions per hour', () => {
      const nextFn = vi.fn();
      (mockRequest as Record<string, unknown>).ip = '192.168.1.101';

      for (let i = 0; i < 5; i++) {
        rateLimitFeedback(mockRequest as Request, mockResponse as Response, nextFn as NextFunction);
      }

      expect(() =>
        rateLimitFeedback(mockRequest as Request, mockResponse as Response, nextFn as NextFunction),
      ).toThrowError(
        expect.objectContaining({
          statusCode: 429,
          code: 'RATE_LIMITED',
        }),
      );
    });

    it('should track rate limits independently for different IP addresses', () => {
      const nextFn = vi.fn();

      (mockRequest as Record<string, unknown>).ip = '192.168.1.201';
      for (let i = 0; i < 5; i++) {
        rateLimitFeedback(mockRequest as Request, mockResponse as Response, nextFn as NextFunction);
      }

      (mockRequest as Record<string, unknown>).ip = '192.168.1.202';
      expect(() =>
        rateLimitFeedback(mockRequest as Request, mockResponse as Response, nextFn as NextFunction),
      ).not.toThrow();
    });
  });
});
