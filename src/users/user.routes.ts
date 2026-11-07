import { Router } from 'express';
import { db } from '@/shared/config/database.js';
import { requireAuth } from '@/shared/middleware/auth.middleware.js';
import { UserController } from './user.controller.js';
import UserService from './user.service.js';

const router = Router();

const userService = new UserService(db);
const userController = new UserController(userService);

/**
 * @route PATCH /api/users/:email/tos
 * @description Accept terms and conditions for a user
 * @access Private
 */
router.patch('/:email/tos', requireAuth, userController.acceptTos);

export default router;
