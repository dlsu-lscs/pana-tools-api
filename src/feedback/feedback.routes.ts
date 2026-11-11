import { Router } from 'express';
import { db } from '@/shared/config/database.js';
import { requireAuth, requireRole } from '@/shared/middleware/auth.middleware.js';
import { rateLimitFeedback } from '@/shared/middleware/rate-limit.middleware.js';
import FeedbackController from './feedback.controller.js';
import FeedbackService from './feedback.service.js';

const router = Router();

const feedbackService = new FeedbackService(db);
const feedbackController = new FeedbackController(feedbackService);

router.post('/', rateLimitFeedback, feedbackController.createFeedback);
router.get('/admin', requireAuth, requireRole('admin'), feedbackController.getFeedbackAdmin);
router.delete('/admin/:id', requireAuth, requireRole('admin'), feedbackController.deleteFeedbackAdmin);

export default router;
