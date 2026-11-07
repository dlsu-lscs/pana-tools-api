import { registry, ErrorResponseSchema, z } from '@/shared/config/openapi.js';
import {
  ApplicationsListQuerySchema,
  AdminApplicationsListQuerySchema,
  ApplicationSlugParamsSchema,
  ApplicationResponseSchema,
  CreateApplicationRequestSchema,
  ApplicationIdParamsSchema,
  PatchApplicationRequestSchema,
  ReviewApplicationRequestSchema,
  ApplicationsListResponseSchema,
} from './dto/index.js';

const ApplicationSlugResponseSchema = z
  .object({
    slug: z.string().openapi({ example: 'my-awesome-app' }),
  })
  .openapi('ApplicationSlugResponse');

/**
 * Register the GET /api/applications endpoint
 */
registry.registerPath({
  method: 'get',
  path: '/api/applications',
  description: 'Get a paginated list of approved applications with optional filters and sorting',
  summary: 'List applications',
  tags: ['Applications'],
  request: {
    query: ApplicationsListQuerySchema,
  },
  responses: {
    200: {
      description: 'Successfully retrieved applications list',
      content: {
        'application/json': {
          schema: ApplicationsListResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid query parameters',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

/**
 * Register the GET /api/applications/:slug endpoint
 */
registry.registerPath({
  method: 'get',
  path: '/api/applications/{slug}',
  description: 'Get a single application by slug',
  summary: 'Get application by slug',
  tags: ['Applications'],
  request: {
    params: ApplicationSlugParamsSchema,
  },
  responses: {
    200: {
      description: 'Successfully retrieved application',
      content: {
        'application/json': {
          schema: ApplicationResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid slug parameter - VALIDATION_ERROR',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Application not found - NOT_FOUND',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error - INTERNAL_ERROR',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

/**
 * Register the GET /api/applications/admin endpoint
 */
registry.registerPath({
  method: 'get',
  path: '/api/applications/admin',
  description: 'Get a paginated list of applications in the moderation queue (Admin only)',
  summary: 'List moderation queue applications',
  security: [{ SessionAuth: [] }],
  tags: ['Applications'],
  request: {
    query: AdminApplicationsListQuerySchema,
  },
  responses: {
    200: {
      description: 'Successfully retrieved moderation queue applications',
      content: {
        'application/json': {
          schema: ApplicationsListResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid query parameters - VALIDATION_ERROR',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - UNAUTHORIZED',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - FORBIDDEN',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error - INTERNAL_ERROR',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

/**
 * Register the POST /api/applications
 */
registry.registerPath({
  method: 'post',
  path: '/api/applications',
  description: 'Create application as the authenticated user',
  summary: 'Create application',
  security: [{ SessionAuth: [] }],
  tags: ['Applications'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateApplicationRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Successfully created application',
      content: {
        'application/json': {
          schema: ApplicationSlugResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid body request - VALIDATION_ERROR',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - UNAUTHORIZED',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Conflict - DUPLICATE_SLUG',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error - INTERNAL_ERROR',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

/**
 * Register the PATCH /api/applications/:id endpoint
 */
registry.registerPath({
  method: 'patch',
  path: '/api/applications/{id}',
  description: 'Partially update your own application by ID',
  summary: 'Update application',
  security: [{ SessionAuth: [] }],
  tags: ['Applications'],
  request: {
    params: ApplicationIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: PatchApplicationRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Successfully updated application',
      content: {
        'application/json': {
          schema: ApplicationSlugResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request data - VALIDATION_ERROR',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - UNAUTHORIZED',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - FORBIDDEN',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Application not found - NOT_FOUND',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Conflict - DUPLICATE_SLUG',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error - INTERNAL_ERROR',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

/**
 * Register the PATCH /api/applications/admin/:id/review endpoint
 */
registry.registerPath({
  method: 'patch',
  path: '/api/applications/admin/{id}/review',
  description:
    'Review application status by ID, including removing approved applications (Admin only)',
  summary: 'Review application',
  security: [{ SessionAuth: [] }],
  tags: ['Applications'],
  request: {
    params: ApplicationIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: ReviewApplicationRequestSchema,
        },
      },
    },
  },
  responses: {
    204: {
      description: 'Successfully reviewed application',
    },
    400: {
      description: 'Invalid request data - VALIDATION_ERROR',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - UNAUTHORIZED',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - FORBIDDEN',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Application not found - NOT_FOUND',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Invalid application state - INVALID_APPLICATION_STATE',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error - INTERNAL_ERROR',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

/**
 * Register the DELETE /api/applications/:id endpoint
 */
registry.registerPath({
  method: 'delete',
  path: '/api/applications/{id}',
  description: 'Delete your own application by ID',
  summary: 'Delete application',
  security: [{ SessionAuth: [] }],
  tags: ['Applications'],
  request: {
    params: ApplicationIdParamsSchema,
  },
  responses: {
    204: {
      description: 'Successfully deleted application',
    },
    401: {
      description: 'Unauthorized - UNAUTHORIZED',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - FORBIDDEN',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Application not found - NOT_FOUND',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error - INTERNAL_ERROR',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

/**
 * Reguster the POST /api/applications/{slug}/view endpoint
 */
registry.registerPath({
  method: 'post',
  path: '/api/applications/{slug}/view',
  description: 'Increment view count for an approved application by slug (Rate limited to 1 per IP per minute per app)',
  summary: 'Increment application view count',
  tags: ['Applications'],
  request: {
    params: ApplicationSlugParamsSchema,
  },
  responses: {
    204: {
      description: 'View count incremented successfully',
    },
    400: {
      description: 'Invalid slug parameter - VALIDATION_ERROR',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Application not found - NOT_FOUND',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    429: {
      description: 'Too many requests - RATE_LIMITED',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error - INTERNAL_ERROR',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});
