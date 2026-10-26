import { z } from '@/shared/config/openapi.js';

/**
 * Base Response DTO for a single application
 */
export const ApplicationResponseSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    title: z.string().openapi({ example: 'My Awesome App' }),
    slug: z.string().openapi({ example: 'my-awesome-app' }),
    userId: z.string().openapi({ example: 'user_123' }),
    description: z.string().nullable().openapi({ example: 'A description of the application' }),
    url: z.string().openapi({ example: 'https://example.com' }),
    githubLink: z.string().nullable().openapi({ example: 'https://github.com/user/repo' }),
    author: z.string().nullable().openapi({ example: 'Jane Doe' }),
    previewImages: z
      .array(z.string())
      .nullable()
      .openapi({ example: ['https://example.com/image1.jpg'] }),
    icon: z.string().nullable().openapi({ example: 'https://example.com/icon.jpg' }),
    tags: z
      .array(z.string())
      .nullable()
      .openapi({ example: ['web', 'mobile'] }),
    status: z
      .enum(['PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REMOVED'])
      .openapi({ example: 'APPROVED' }),
    rejectionReason: z.string().nullable().openapi({ example: null }),
    unclaimed: z.boolean().openapi({ example: false }),
    createdAt: z.date().openapi({ example: '2025-01-01T00:00:00.000Z' }),
    updatedAt: z.date().openapi({ example: '2025-01-01T00:00:00.000Z' }),
    userEmail: z.email().openapi({ example: 'user@example.com' }),
    favoritesCount: z.number().int().nonnegative().openapi({ example: 12 }),
    ratingCount: z.number().int().nonnegative().openapi({ example: 5 }),
    averageRating: z.number().nullable().openapi({ example: 4.2 }),
    viewCount: z.number().int().nonnegative().openapi({ example: 42 }),
  })
  .openapi('ApplicationResponse');

/**
 * Response DTO for paginated applications list
 */
export const ApplicationsListResponseSchema = z
  .object({
    data: z.array(ApplicationResponseSchema),
    meta: z.object({
      page: z.number().openapi({ example: 1 }),
      limit: z.number().openapi({ example: 10 }),
      count: z.number().openapi({ example: 10 }),
      total: z.number().openapi({ example: 100 }),
      totalPages: z.number().openapi({ example: 10 }),
    }),
  })
  .openapi('ApplicationsListResponse');

export type ApplicationResponse = z.infer<typeof ApplicationResponseSchema>;
export type ApplicationsListResponse = z.infer<typeof ApplicationsListResponseSchema>;
