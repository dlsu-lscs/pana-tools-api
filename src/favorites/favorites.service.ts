import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, count, eq } from 'drizzle-orm';
import { HttpError } from '@/shared/middleware/error.middleware.js';
import {
  application,
  InsertFavorite,
  SelectFavorite,
  user,
  userFavorite,
} from './favorites.model.js';

/**
 * Service result type for favorites list
 */
export type FavoritesList = {
  data: SelectFavorite[];
  total: number;
};

export interface IFavoritesService {
  createFavorite(favorite: InsertFavorite): Promise<void>;
  getUserFavorite(userId: string): Promise<number[]>;
  getApplicationFavorites(applicationId: number): Promise<string[]>;
  getApplicationFavoritesCount(applicationId: number): Promise<number>;
  deleteFavorite(userId: string, applicationId: number): Promise<SelectFavorite>;
}

/**
 * Service layer for favorites-related business logic
 */
export default class FavoritesService {
  constructor(private readonly db: NodePgDatabase) {}

  private ensureUserExists = async (userId: string): Promise<void> => {
    const [existingUser] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!existingUser) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }
  };

  private ensureApplicationExists = async (applicationId: number): Promise<void> => {
    const [existingApplication] = await this.db
      .select({ id: application.id })
      .from(application)
      .where(eq(application.id, applicationId))
      .limit(1);

    if (!existingApplication) {
      throw new HttpError(404, 'Application not found', 'NOT_FOUND');
    }
  };

  /**
   * Retrieves a single favorite relation by user and application IDs
   * @param userId - User ID
   * @param applicationId - Application ID
   * @access Private
   * @returns The favorite relation, or undefined if not found
   */
  private getFavorite = async (
    userId: string,
    applicationId: number,
  ): Promise<SelectFavorite | undefined> => {
    const [favorite] = await this.db
      .select()
      .from(userFavorite)
      .where(and(eq(userFavorite.userId, userId), eq(userFavorite.applicationId, applicationId)))
      .limit(1);

    return favorite;
  };

  /**
   * Creates a favorite relation between a user and an application
   * @param favorite - Favorite relation data to insert
   * @returns Nothing
   * @throws HttpError 409 if favorite relation already exists
   */
  createFavorite = async (favorite: InsertFavorite): Promise<void> => {
    await Promise.all([
      this.ensureUserExists(favorite.userId),
      this.ensureApplicationExists(favorite.applicationId),
    ]);

    const existing = await this.getFavorite(favorite.userId, favorite.applicationId);

    if (existing) {
      throw new HttpError(409, 'Favorite already exists', 'DUPLICATE_FAVORITE');
    }

    await this.db.insert(userFavorite).values(favorite);
  };

  /**
   * Retrieves all application IDs favorited by a user
   * @param userId - User ID
   * @returns List of application IDs favorited by the user
   */
  getUserFavorite = async (userId: string): Promise<number[]> => {
    const favorites = await this.db
      .select({ applicationId: userFavorite.applicationId })
      .from(userFavorite)
      .where(eq(userFavorite.userId, userId));

    return favorites.length > 0 ? favorites.map((fav) => fav.applicationId) : [];
  };

  /**
   * Retrieves all user IDs who favorited an application
   * @param applicationId - Application ID
   * @returns List of user IDs who favorited the application
   */
  getApplicationFavorites = async (applicationId: number): Promise<string[]> => {
    const favorites = await this.db
      .select({ userId: userFavorite.userId })
      .from(userFavorite)
      .where(eq(userFavorite.applicationId, applicationId));

    return favorites.length > 0 ? favorites.map((favorite) => favorite.userId) : [];
  };

  /**
   * Retrieves the total number of users who favorited an application
   * @param applicationId - Application ID
   * @returns Total favorites count for the application
   */
  getApplicationFavoritesCount = async (applicationId: number): Promise<number> => {
    const [{ value: favoritesCount }] = await this.db
      .select({ value: count() })
      .from(userFavorite)
      .where(eq(userFavorite.applicationId, applicationId));

    return favoritesCount;
  };

  /**
   * Deletes a favorite relation by user and application IDs
   * @param userId - User ID
   * @param applicationId - Application ID
   * @returns The deleted favorite relation
   * @throws HttpError 404 if favorite relation does not exist
   */
  deleteFavorite = async (userId: string, applicationId: number): Promise<SelectFavorite> => {
    const existing = await this.getFavorite(userId, applicationId);

    if (!existing) {
      throw new HttpError(404, 'Favorite not found', 'NOT_FOUND');
    }

    const [deletedFavorite] = await this.db
      .delete(userFavorite)
      .where(and(eq(userFavorite.userId, userId), eq(userFavorite.applicationId, applicationId)))
      .returning();

    return deletedFavorite;
  };
}
