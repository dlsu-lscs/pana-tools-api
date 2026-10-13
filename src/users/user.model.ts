import { user } from '@/shared/infrastructure/database/schema.js';
export { user } from '@/shared/infrastructure/database/schema.js';

export type SelectUser = typeof user.$inferSelect;
export type InsertUser = typeof user.$inferInsert;
