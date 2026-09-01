import { application, rating, report, user } from '@/shared/infrastructure/database/schema.js';

export { application, rating, report, user };

export type SelectReport = typeof report.$inferSelect;
export type InsertReport = typeof report.$inferInsert;
