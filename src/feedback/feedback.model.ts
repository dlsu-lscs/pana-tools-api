import { randomUUID } from 'node:crypto';
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { user } from '@/users/user.model.js';

export type SelectFeedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;

export const feedbackCategory = pgEnum('feedback_category', [
  'bug',
  'feature_request',
  'general',
  'improvement',
]);

export const feedbackSortOptions = pgEnum('feedback_sort_options', [
  'createdAt',
  'category',
  'email',
]);

export const feedback = pgTable(
  'feedback',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text('user_id'),
    email: text(),
    category: feedbackCategory().notNull(),
    message: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('feedback_user_id_idx').on(table.userId),
    index('feedback_category_idx').on(table.category),

    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'feedback_user_id_users_id_fk',
    }).onDelete('cascade'),
  ],
);
