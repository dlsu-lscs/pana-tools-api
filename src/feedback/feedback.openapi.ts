import { ErrorResponseSchema, registry } from '@/shared/config/openapi.js';
import {
  CreateFeedbackRequestSchema,
  FeedbackListQuerySchema,
  FeedbackParamsSchema,
  FeedbackResponseSchema,
  FeedbackListResponseSchema,
} from './dto/index.js';

const authenticatedUserSecurity: Array<Record<string, string[]>> = [
  { SessionAuth: [], StateAuth: [] },
];

registry.register('CreateFeedbackRequest', CreateFeedbackRequestSchema);
registry.register('FeedbackListQuery', FeedbackListQuerySchema);
registry.register('FeedbackParams', FeedbackParamsSchema);
registry.register('FeedbackResponse', FeedbackResponseSchema);
registry.register('FeedbackListResponse', FeedbackListResponseSchema);

registry.registerPath({
  method: 'post',
  path: '/api/feedback',
  description: 'Submit platform feedback (public endpoint with optional session detection and IP rate limiting)',
  summary: 'Submit feedback',
  tags: ['Feedback'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateFeedbackRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Successfully submitted feedback',
      content: {
        'application/json': {
          schema: FeedbackResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error - VALIDATION_ERROR',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    429: {
      description: 'Rate limit exceeded - RATE_LIMITED',
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

registry.registerPath({
  method: 'get',
  path: '/api/feedback/admin',
  description: 'List feedback entries with pagination and category filtering (Admin only)',
  summary: 'Get admin feedback list',
  security: authenticatedUserSecurity,
  tags: ['Feedback'],
  request: {
    query: FeedbackListQuerySchema,
  },
  responses: {
    200: {
      description: 'Successfully retrieved feedback list',
      content: {
        'application/json': {
          schema: FeedbackListResponseSchema,
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
      description: 'Forbidden - Admin only - FORBIDDEN',
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

registry.registerPath({
  method: 'delete',
  path: '/api/feedback/admin/{id}',
  description: 'Delete feedback entry (Admin only)',
  summary: 'Delete feedback',
  security: authenticatedUserSecurity,
  tags: ['Feedback'],
  request: {
    params: FeedbackParamsSchema,
  },
  responses: {
    200: {
      description: 'Successfully deleted feedback',
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
      description: 'Forbidden - Admin only - FORBIDDEN',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Feedback not found - NOT_FOUND',
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
