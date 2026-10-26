import { z } from '@/shared/config/openapi.js';

export const UserEmailParamsSchema = z
  .object({
    email: z.string().email().openapi({ example: 'jane@example.com' }),
  })
  .openapi('UserEmailParams');

export const UserResponseSchema = z
  .object({
    id: z.string().openapi({ example: 'user_abc123' }),
    name: z.string().openapi({ example: 'Jane Doe' }),
    email: z.string().email().openapi({ example: 'jane@example.com' }),
    emailVerified: z.boolean().openapi({ example: true }),
    image: z.string().nullable().openapi({ example: 'https://example.com/avatar.jpg' }),
    website: z.string().nullable().openapi({ example: 'https://example.com' }),
    logo: z.string().nullable().openapi({ example: 'https://example.com/logo.png' }),
    role: z.string().nullable().openapi({ example: 'user' }),
    banned: z.boolean().nullable().openapi({ example: false }),
    banReason: z.string().nullable().openapi({ example: null }),
    banExpires: z.date().nullable().openapi({ example: null }),
    tosAccepted: z.boolean().openapi({ example: true }),
    tosAcceptedAt: z.date().nullable().openapi({ example: '2025-01-01T00:00:00.000Z' }),
    createdAt: z.date().openapi({ example: '2025-01-01T00:00:00.000Z' }),
    updatedAt: z.date().openapi({ example: '2025-01-01T00:00:00.000Z' }),
  })
  .openapi('UserResponse');

export const UserTosResponseSchema = z
  .object({
    id: z.string().openapi({ example: 'user_abc123' }),
    email: z.string().email().openapi({ example: 'jane@example.com' }),
    tosAccepted: z.boolean().openapi({ example: true }),
    tosAcceptedAt: z.date().nullable().openapi({ example: '2025-01-01T00:00:00.000Z' }),
  })
  .openapi('UserTosResponse');

export type UserEmailParams = z.infer<typeof UserEmailParamsSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type UserTosResponse = z.infer<typeof UserTosResponseSchema>;
