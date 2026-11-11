import type { Request, Response } from 'express';
import { logger } from '@/shared/utils/logger.js';
import { getSession } from '@/shared/middleware/auth.middleware.js';
import type { IFeedbackService } from './feedback.service.js';
import {
  CreateFeedbackRequestSchema,
  FeedbackListQuerySchema,
  FeedbackParamsSchema,
  FeedbackResponseSchema,
  FeedbackListResponseSchema,
  type FeedbackListResponse,
} from './dto/index.js';

export default class FeedbackController {
  constructor(private readonly feedbackService: IFeedbackService) {}

  /**
   * Handles public feedback submission with optional session detection, extracting session.user.id
   * if authenticated or leaving userId null for visitors without failing unauthenticated requests.
   */
  createFeedback = async (req: Request, res: Response): Promise<void> => {
    const body = CreateFeedbackRequestSchema.parse(req.body);

    let userId: string | null = (res.locals?.authUserId as string | undefined) ?? null;
    if (!userId) {
      try {
        const session = await getSession(req);
        if (session?.user?.id) {
          userId = session.user.id;
        }
      } catch {
        userId = null;
      }
    }

    logger.debug('Submitting platform feedback', { userId, category: body.category });

    const created = await this.feedbackService.createFeedback(
      {
        category: body.category,
        message: body.message,
        email: body.email ?? null,
      },
      userId ?? undefined,
    );

    const validatedResponse = FeedbackResponseSchema.parse(created);
    logger.info('Feedback submitted successfully', { feedbackId: validatedResponse.id });
    res.status(201).json(validatedResponse);
  };

  /**
   * Fetches paginated feedback for administrators with optional category filtering,
   * returning metadata and results sorted in descending chronological order.
   */
  getFeedbackAdmin = async (req: Request, res: Response): Promise<void> => {
    const query = FeedbackListQuerySchema.parse(req.query);

    logger.debug('Fetching feedback list for admin', { query });

    const result = await this.feedbackService.listFeedback(query);

    const validatedResponse: FeedbackListResponse = FeedbackListResponseSchema.parse({
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });

    logger.info('Admin feedback retrieved successfully', {
      total: validatedResponse.total,
      page: validatedResponse.page,
    });

    res.status(200).json(validatedResponse);
  };

  /**
   * Handles deletion of feedback records by ID, protected for administrator access only
   * and returning a clean confirmation response.
   */
  deleteFeedbackAdmin = async (req: Request, res: Response): Promise<void> => {
    const params = FeedbackParamsSchema.parse(req.params);

    logger.debug('Deleting feedback by admin', { feedbackId: params.id });

    await this.feedbackService.deleteFeedback(params.id);

    logger.info('Feedback deleted successfully', { feedbackId: params.id });

    res.status(200).json({ message: 'Feedback deleted successfully' });
  };
}
