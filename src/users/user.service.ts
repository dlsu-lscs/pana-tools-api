import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { HttpError } from '@/shared/middleware/error.middleware.js';
import { user } from './user.model.js';
import type { UserTosResponse } from './dto/index.js';

export interface IUserService {
  acceptTos(email: string, actorUserId: string): Promise<UserTosResponse>;
}

export default class UserService implements IUserService {
  constructor(private readonly db: NodePgDatabase) {}

  acceptTos = async (
    email: string,
    actorUserId: string,
  ): Promise<UserTosResponse> => {
    const [existingUser] = await this.db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (!existingUser) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }

    if (actorUserId !== existingUser.id) {
      throw new HttpError(403, 'Forbidden', 'FORBIDDEN');
    }

    const now = new Date();
    const [updatedUser] = await this.db
      .update(user)
      .set({
        tosAccepted: true,
        tosAcceptedAt: existingUser.tosAcceptedAt ?? now,
      })
      .where(eq(user.id, existingUser.id))
      .returning();

    return updatedUser;
  };
}
