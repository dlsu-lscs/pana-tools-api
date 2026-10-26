import { z } from '@/shared/config/openapi.js';
import { APPLICATION_CONSTANTS } from '../application.constants.js';

/**
 * Zod schema for all query parameters (pagination + filters)
 */
export const ApplicationsListQuerySchema = z
  .object({
    // Pagination
    limit: z.coerce
      .number()
      .min(1)
      .max(APPLICATION_CONSTANTS.MAX_LIMIT)
      .default(APPLICATION_CONSTANTS.DEFAULT_LIMIT)
      .openapi({ example: 10, description: 'Number of items per page' }),
    page: z.coerce
      .number()
      .min(1)
      .default(APPLICATION_CONSTANTS.DEFAULT_PAGE)
      .openapi({ example: 1, description: 'Page number' }),

    // Date range filters
    createdAfter: z.coerce.date().nullish().openapi({
      example: '2025-01-01T00:00:00.000Z',
      description: 'Filter applications created after this date',
    }),
    createdBefore: z.coerce.date().nullish().openapi({
      example: '2025-12-31T23:59:59.999Z',
      description: 'Filter applications created before this date',
    }),

    // Search filters
    search: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .nullish()
      .openapi({ example: 'web app', description: 'Search in title and description' }),
    tags: z
      .union([z.string(), z.array(z.string())])
      .transform((val) => (Array.isArray(val) ? val : [val]))
      .nullish()
      .openapi({ example: ['web', 'mobile'], description: 'Filter by tags' }),
    userId: z
      .string()
      .trim()
      .min(1)
      .nullish()
      .openapi({ example: 'user_123', description: 'Filter by user ID' }),

    // Sorting options
    sortBy: z
      .enum([
        'createdAt',
        'updatedAt',
        'title',
        'viewCount',
        'favoritesCount',
        'ratingCount',
        'averageRating',
      ])
      .default(APPLICATION_CONSTANTS.DEFAULT_SORT_BY)
      .nullish()
      .openapi({ example: 'createdAt', description: 'Field to sort by' }),
    sortOrder: z
      .enum(['asc', 'desc'])
      .default(APPLICATION_CONSTANTS.DEFAULT_SORT_ORDER)
      .nullish()
      .openapi({ example: 'desc', description: 'Sort order' }),
  })
  .openapi('ApplicationsListQuery');

/**
 * Schema for just the filters (without pagination)
 */
export const ApplicationsListFiltersSchema = ApplicationsListQuerySchema.omit({
  limit: true,
  page: true,
});

/**
 * Infer TypeScript types from Zod schemas
 */
export type ApplicationsListQuery = z.infer<typeof ApplicationsListQuerySchema>;
export type ApplicationsListFilters = z.infer<typeof ApplicationsListFiltersSchema>;
