import { registry, ErrorResponseSchema } from '@/shared/config/openapi.js';
import { UserEmailParamsSchema, UserTosResponseSchema } from './dto/index.js';

registry.register('UserEmailParams', UserEmailParamsSchema);
registry.register('UserTosResponse', UserTosResponseSchema);

registry.registerPath({
  method: 'patch',
  path: '/api/users/{email}/tos',
  description: 'Accept terms and conditions (owner-only, no admin override)',
  summary: 'Accept terms and conditions',
  security: [{ SessionAuth: [] }],
  tags: ['Users'],
  request: {
    params: UserEmailParamsSchema,
  },
  responses: {
    200: {
      description: 'Successfully accepted terms and conditions',
      content: {
        'application/json': {
          schema: UserTosResponseSchema,
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
      description: 'User not found - NOT_FOUND',
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
