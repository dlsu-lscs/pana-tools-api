import {
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  timestamp,
  unique,
  index,
  foreignKey
} from 'drizzle-orm/pg-core';


import { user } from '@/users/user.model.js'

export type SelectReport = typeof report.$inferSelect;
export type InsertReport = typeof report.$inferInsert;

export const reportTargetType = pgEnum('report_target_type', ['application', 'review']);

export const reportReason = pgEnum('report_reason', [
  'spam',
  'inappropriate',
  'misleading',
  'offensive',
  'other',
]);

export const reportStatus = pgEnum('report_status', ['pending', 'reviewed', 'resolved', 'dismissed']);

export const report = pgTable(
  'report',
  {
    id: serial().primaryKey().notNull(),
    reporterId: text('reporter_id').notNull(),
    targetType: reportTargetType('target_type').notNull(),
    targetId: integer('target_id').notNull(),
    reason: reportReason('reason').notNull(),
    description: text('description'),
    status: reportStatus('status').default('pending').notNull(),
    adminNote: text('admin_note'),
    reviewedBy: text('reviewed_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique('report_reporter_target_unq').on(table.reporterId, table.targetType, table.targetId),
    index('report_reporter_id_idx').on(table.reporterId),
    index('report_target_type_idx').on(table.targetType),
    index('report_status_idx').on(table.status),
    foreignKey({
      columns: [table.reporterId],
      foreignColumns: [user.id],
      name: 'report_reporter_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.reviewedBy],
      foreignColumns: [user.id],
      name: 'report_reviewed_by_fkey',
    }).onDelete('set null'),
  ],
);
