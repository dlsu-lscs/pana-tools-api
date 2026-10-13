import { z } from '@/shared/config/openapi.js';
import '@/shared/config/openapi.js';

export const RatingResponseSchema = z
  .object({
    applicationId: z.coerce.number().int().positive().openapi({ example: 42 }),
    score: z.coerce.number().min(0).max(5).openapi({ example: 4.5 }),
    comment: z.string().nullable().openapi({ example: 'Highly recommended' }),
    isAnonymous: z.coerce.boolean().openapi({ example: false }),
    userEmail: z.email().nullable().openapi({ example: 'user@example.com' }),
    userName: z.string().nullable().openapi({ example: 'Jane Doe' }),
  })
  .openapi('RatingResponse');

export const ApplicationRatingResponseSchema = z
  .object({
    applicationSlug: z.string().openapi({ example: 'my-awesome-app' }),
    ratings: z.array(RatingResponseSchema),
    total: z.coerce.number().int().nonnegative().openapi({ example: 2 }),
    averageScore: z.coerce.number().min(0).max(5).openapi({ example: 4.25 }),
  })
  .openapi('ApplicationRatingResponse');

export const UserRatingApplicationSchema = z
  .object({
    id: z.coerce.number().int().positive().openapi({ example: 1 }),
    slug: z.string().openapi({ example: 'my-awesome-app' }),
    title: z.string().openapi({ example: 'My Awesome App' }),
  })
  .openapi('UserRatingApplication');

export const UserRatingItemSchema = z
  .object({
    userId: z.string().nullable().openapi({ example: 'user_123' }),
    applicationId: z.coerce.number().int().positive().openapi({ example: 42 }),
    score: z.coerce.number().min(0).max(5).openapi({ example: 4.5 }),
    comment: z.string().nullable().openapi({ example: 'Highly recommended' }),
    isAnonymous: z.coerce.boolean().openapi({ example: false }),
    application: UserRatingApplicationSchema,
  })
  .openapi('UserRatingItem');

export const UserRatingsResponseSchema = z
  .object({
    userId: z.string().openapi({ example: 'user_123' }),
    ratings: z.array(UserRatingItemSchema),
    total: z.coerce.number().int().nonnegative().openapi({ example: 2 }),
  })
  .openapi('UserRatingsResponse');

export type RatingResponse = z.infer<typeof RatingResponseSchema>;
export type ApplicationRatingResponse = z.infer<typeof ApplicationRatingResponseSchema>;
export type UserRatingItem = z.infer<typeof UserRatingItemSchema>;
export type UserRatingsResponse = z.infer<typeof UserRatingsResponseSchema>;
