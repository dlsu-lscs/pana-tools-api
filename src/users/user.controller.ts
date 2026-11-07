import type { Request, Response } from 'express';
import type { IUserService } from './user.service.js';
import { UserEmailParamsSchema, UserTosResponseSchema } from './dto/index.js';
import { HttpError } from '@/shared/middleware/error.middleware.js';
import { logger } from '@/shared/utils/logger.js';

export class UserController {
  constructor(private readonly userService: IUserService) {}

  acceptTos = async (req: Request, res: Response): Promise<void> => {
    const { email } = UserEmailParamsSchema.parse(req.params);
    const authUserId = this.getAuthUserId(res);

    logger.debug('Accepting terms of service for user', { email, authUserId });

    const updatedUser = await this.userService.acceptTos(email, authUserId);

    logger.info('Terms of service accepted successfully', { email, authUserId });

    const parsed = UserTosResponseSchema.parse(updatedUser);
    res.status(200).json(parsed);
  };

  private getAuthUserId(res: Response): string {
    const authUserId = res.locals.authUserId as string | undefined;
    if (!authUserId) throw new HttpError(401, 'Unauthorized', 'UNAUTHORIZED');
    return authUserId;
  }
}
export default UserController;
