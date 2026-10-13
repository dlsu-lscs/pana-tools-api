import { application, rating, user } from '@/shared/infrastructure/database/schema.js';

export { application, rating, user };

export type SelectRating = typeof rating.$inferSelect;
export type InsertRating = typeof rating.$inferInsert;
