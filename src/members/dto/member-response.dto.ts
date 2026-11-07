import { z } from '@/shared/config/openapi.js';

export const MemberResponseSchema = z
  .object({
    id: z.string().openapi({ example: 'user_abc123' }),
    name: z.string().openapi({ example: 'Jane Doe' }),
    email: z.email().openapi({ example: 'jane@example.com' }),
    image: z.string().nullable().openapi({ example: 'https://example.com/avatar.jpg' }),
    role: z.string().nullable().openapi({ example: 'admin' }),
    banned: z.boolean().nullable().openapi({ example: false }),
    banReason: z.string().nullable().openapi({ example: null }),
    banExpires: z.string().nullable().openapi({ example: null }),
    tosAccepted: z.boolean().openapi({ example: true }),
    tosAcceptedAt: z.date().nullable().openapi({ example: '2025-01-01T00:00:00.000Z' }),
    createdAt: z.date().openapi({ example: '2025-01-01T00:00:00.000Z' }),
    favoritesCount: z.number().int().nonnegative().openapi({ example: 5 }),
    reviewsCount: z.number().int().nonnegative().openapi({ example: 3 }),
    pendingCount: z.number().int().nonnegative().openapi({ example: 1 }),
    approvedCount: z.number().int().nonnegative().openapi({ example: 2 }),
    changesRequestedCount: z.number().int().nonnegative().openapi({ example: 0 }),
    removedCount: z.number().int().nonnegative().openapi({ example: 0 }),
    lastLogin: z.string().nullable().openapi({ example: '2025-06-01T10:00:00.000Z' }),
  })
  .openapi('MemberResponse');

export const MembersListResponseSchema = z
  .object({
    data: z.array(MemberResponseSchema),
    meta: z.object({
      page: z.number().openapi({ example: 1 }),
      limit: z.number().openapi({ example: 20 }),
      count: z.number().openapi({ example: 20 }),
      total: z.number().openapi({ example: 100 }),
      totalPages: z.number().openapi({ example: 5 }),
    }),
  })
  .openapi('MembersListResponse');

export const BanMemberRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(500).openapi({ example: 'Violated community guidelines' }),
  })
  .openapi('BanMemberRequest');

export const MemberUserIdParamsSchema = z
  .object({
    userId: z.string().trim().min(1).openapi({ example: 'user_abc123' }),
  })
  .openapi('MemberUserIdParams');

export const MemberReviewResponseSchema = z
  .object({
    applicationId: z.number().openapi({ example: 1 }),
    applicationTitle: z.string().openapi({ example: 'My App' }),
    applicationSlug: z.string().openapi({ example: 'my-app' }),
    score: z.number().openapi({ example: 4.5 }),
    comment: z.string().nullable().openapi({ example: 'Great app!' }),
    isAnonymous: z.boolean().openapi({ example: false }),
  })
  .openapi('MemberReviewResponse');

export const MemberReviewsListResponseSchema = z
  .object({
    data: z.array(MemberReviewResponseSchema),
  })
  .openapi('MemberReviewsListResponse');

export type MemberResponse = z.infer<typeof MemberResponseSchema>;
export type MembersListResponse = z.infer<typeof MembersListResponseSchema>;
export type BanMemberRequest = z.infer<typeof BanMemberRequestSchema>;
export type MemberUserIdParams = z.infer<typeof MemberUserIdParamsSchema>;
export type MemberReviewResponse = z.infer<typeof MemberReviewResponseSchema>;
export type MemberReviewsListResponse = z.infer<typeof MemberReviewsListResponseSchema>;
