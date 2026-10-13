import {
    pgTable,
    text,
    integer,
    index,
    foreignKey,
    primaryKey
} from 'drizzle-orm/pg-core';

import { user } from '@/users/user.model.js';
import { application } from '@/applications/application.model.js';

export type SelectFavorite = typeof userFavorite.$inferSelect;
export type InsertFavorite = typeof userFavorite.$inferInsert;


export const userFavorite = pgTable(
  'user_favorite',
  {
    userId: text('user_id').notNull(),
    applicationId: integer('application_id').notNull(),
  },
  (table) => [
    index('user_favorite_application_id_idx').on(table.applicationId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'user_favorite_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.applicationId],
      foreignColumns: [application.id],
      name: 'user_favorite_application_id_fkey',
    }).onDelete('cascade'),
    primaryKey({ columns: [table.userId, table.applicationId], name: 'user_favorite_pkey' }),
  ],
);
