import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import UserController from '../user.controller.js';
import type { IUserService } from '../user.service.js';
import { ZodError } from 'zod';

describe('UserController', () => {
  let controller: UserController;
  let mockUserService: IUserService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: ReturnType<typeof vi.fn>;
  let responseStatus: ReturnType<typeof vi.fn>;

  const mockDate = new Date('2026-08-20T00:00:00.000Z');
  const mockUserResponse = {
    id: 'user-123',
    name: 'Jane Doe',
    email: 'jane@example.com',
    emailVerified: true,
    image: null,
    website: null,
    logo: null,
    role: 'user',
    banned: false,
    banReason: null,
    banExpires: null,
    tosAccepted: true,
    tosAcceptedAt: mockDate,
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  beforeEach(() => {
    mockUserService = {
      acceptTos: vi.fn().mockResolvedValue(mockUserResponse),
    };

    controller = new UserController(mockUserService);

    responseJson = vi.fn();
    responseStatus = vi.fn().mockReturnValue({ json: responseJson });

    mockResponse = {
      locals: {
        authUserId: 'user-123',
      },
      status: responseStatus,
    };

    mockRequest = {
      params: {
        email: 'jane@example.com',
      },
    };
  });

  describe('acceptTos', () => {
    it('should successfully accept ToS and return 200 with UserTosResponse shape', async () => {
      await controller.acceptTos(mockRequest as Request, mockResponse as Response);

      expect(mockUserService.acceptTos).toHaveBeenCalledWith(
        'jane@example.com',
        'user-123',
      );
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'jane@example.com',
        tosAccepted: true,
        tosAcceptedAt: mockDate,
      });
    });

    it('should return only UserTosResponse fields, not the full user object', async () => {
      await controller.acceptTos(mockRequest as Request, mockResponse as Response);

      const returnedPayload = responseJson.mock.calls[0][0];
      expect(returnedPayload).not.toHaveProperty('name');
      expect(returnedPayload).not.toHaveProperty('role');
      expect(returnedPayload).not.toHaveProperty('createdAt');
      expect(returnedPayload).not.toHaveProperty('updatedAt');
      expect(returnedPayload).not.toHaveProperty('banned');
    });

    it('should throw 401 when authUserId is missing from res.locals', async () => {
      mockResponse.locals = {};

      await expect(
        controller.acceptTos(mockRequest as Request, mockResponse as Response),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    });

    it('should throw Zod validation error when email param is invalid', async () => {
      mockRequest.params = { email: 'not-an-email' };

      await expect(
        controller.acceptTos(mockRequest as Request, mockResponse as Response),
      ).rejects.toBeInstanceOf(ZodError);
    });
  });
});
