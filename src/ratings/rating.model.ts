import {
    pgTable,
    serial,
    text,
    integer,
    varchar,
    boolean,
    doublePrecision,
    primaryKey,
    unique,
    foreignKey,
    index,
    check
} from 'drizzle-orm/pg-core';

import { sql } from 'drizzle-orm';

import { application } from "@/applications/application.model.js";
import { user } from '@/users/user.model.js';


export type SelectRating = typeof rating.$inferSelect;
export type InsertRating = typeof rating.$inferInsert;


export const rating = pgTable(
  'rating',
  {
    id: serial('id').notNull(),
    userId: text('user_id').notNull(),
    applicationId: integer('application_id').notNull(),
    comment: varchar({ length: 255 }),
    isAnonymous: boolean('is_anonymous').notNull().default(false),
    score: doublePrecision().default(0).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.applicationId],
      name: 'rating_pkey',
    }),
    unique('rating_id_unq').on(table.id),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'rating_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.applicationId],
      foreignColumns: [application.id],
      name: 'rating_application_id_fkey',
    }).onDelete('cascade'),
    index('rating_application_id_idx').on(table.applicationId),
    check(
      'rating_score_check',
      sql`(score >= (0.0)::double precision) AND (score <= (5.0)::double precision)`,
    ),
  ],
);