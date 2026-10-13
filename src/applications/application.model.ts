import { application, applicationClaimRequest } from '@/shared/infrastructure/database/schema.js';
export { application, userFavorite, user, rating, applicationClaimRequest } from '@/shared/infrastructure/database/schema.js';
export type SelectApplication = typeof application.$inferSelect;
export type InsertApplication = typeof application.$inferInsert;
export type SelectClaimRequest = typeof applicationClaimRequest.$inferSelect;
export type InsertClaimRequest = typeof applicationClaimRequest.$inferInsert;
