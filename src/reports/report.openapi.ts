import { ErrorResponseSchema, registry } from '@/shared/config/openapi.js';
import {
  CreateReportRequestSchema,
  CheckReportQuerySchema,
  AdminReportsQuerySchema,
  UpdateReportRequestSchema,
  ReportParamsSchema,
  ReportResponseSchema,
  CheckReportResponseSchema,
  AdminReportsListResponseSchema,
} from './dto/index.js';

const authenticatedUserSecurity: Array<Record<string, string[]>> = [
  { SessionAuth: [], StateAuth: [] },
];

registry.register('CreateReportRequest', CreateReportRequestSchema);
registry.register('CheckReportQuery', CheckReportQuerySchema);
registry.register('AdminReportsQuery', AdminReportsQuerySchema);
registry.register('UpdateReportRequest', UpdateReportRequestSchema);
registry.register('ReportParams', ReportParamsSchema);

registry.registerPath({
  method: 'post',
  path: '/api/reports',
  description: 'Submit a new report for an application or review',
  summary: 'Create report',
  security: authenticatedUserSecurity,
  tags: ['Reports'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateReportRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Successfully created report',
      content: {
        'application/json': {
          schema: ReportResponseSchema,
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
      description: 'Cannot report own content - FORBIDDEN',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Target not found - NOT_FOUND',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Duplicate report - DUPLICATE_REPORT',
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
  path: '/api/reports/check',
  description: 'Check if the current user has already reported a specific target',
  summary: 'Check report status',
  security: authenticatedUserSecurity,
  tags: ['Reports'],
  request: {
    query: CheckReportQuerySchema,
  },
  responses: {
    200: {
      description: 'Successfully checked report status',
      content: {
        'application/json': {
          schema: CheckReportResponseSchema,
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
  path: '/api/reports/admin',
  description: 'List all reports with optional filters and pagination (Admin only)',
  summary: 'Get admin reports',
  security: authenticatedUserSecurity,
  tags: ['Reports'],
  request: {
    query: AdminReportsQuerySchema,
  },
  responses: {
    200: {
      description: 'Successfully retrieved reports list',
      content: {
        'application/json': {
          schema: AdminReportsListResponseSchema,
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
  method: 'patch',
  path: '/api/reports/admin/{id}',
  description: 'Update a report status and admin note (Admin only)',
  summary: 'Update report',
  security: authenticatedUserSecurity,
  tags: ['Reports'],
  request: {
    params: ReportParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateReportRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Successfully updated report',
      content: {
        'application/json': {
          schema: ReportResponseSchema,
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
    404: {
      description: 'Report not found - NOT_FOUND',
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
  path: '/api/reports/admin/{id}',
  description: 'Delete a report (Admin only)',
  summary: 'Delete report',
  security: authenticatedUserSecurity,
  tags: ['Reports'],
  request: {
    params: ReportParamsSchema,
  },
  responses: {
    200: {
      description: 'Successfully deleted report',
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
      description: 'Report not found - NOT_FOUND',
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
