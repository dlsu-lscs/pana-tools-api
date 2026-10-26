import {
    pgEnum,
    pgTable,
    serial,
    varchar,
    text,
    boolean,
    integer,
    timestamp,
    index,
    foreignKey,
    unique
} from 'drizzle-orm/pg-core';

import { user } from '@/users/user.model.js';

export type SelectApplication = typeof application.$inferSelect;
export type InsertApplication = typeof application.$inferInsert;
export type SelectClaimRequest = typeof applicationClaimRequest.$inferSelect;
export type InsertClaimRequest = typeof applicationClaimRequest.$inferInsert;

export const claimRequestStatus = pgEnum('claim_request_status', ['PENDING', 'APPROVED', 'DECLINED']);

export const applicationApprovalStatus = pgEnum('application_approval_status', [
  'PENDING',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REMOVED',
]);

export const application = pgTable(
  'application',
  {
    id: serial().primaryKey().notNull(),
    title: varchar({ length: 255 }).notNull(),
    slug: varchar({ length: 255 }).notNull().unique(),
    userId: text('user_id').notNull(),
    description: text(),
    url: text().notNull().default(''),
    githubLink: text('github_link'),
    author: varchar({ length: 255 }),
    previewImages: text('preview_images').array(),
    icon: text('icon'),
    tags: varchar({ length: 50 }).array(),
    status: applicationApprovalStatus('status').default('PENDING').notNull(),
    rejectionReason: text('rejection_reason'),
    unclaimed: boolean('unclaimed').notNull().default(false),
    viewCount: integer('view_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('application_user_id_idx').on(table.userId),
    index('application_created_at_idx').on(table.createdAt),
    index('application_updated_at_idx').on(table.updatedAt),
    index('application_title_idx').on(table.title),
    index('application_status_idx').on(table.status),
    index('application_view_count_idx').on(table.viewCount),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'applications_user_id_users_id_fk',
    }).onDelete('cascade'),
  ],
);


export const applicationClaimRequest = pgTable(
  'application_claim_request',
  {
    id: serial().primaryKey().notNull(),
    applicationId: integer('application_id').notNull(),
    userId: text('user_id').notNull(),
    additionalInfo: text('additional_info'),
    status: claimRequestStatus('status').notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    unique('claim_request_application_user_unq').on(table.applicationId, table.userId),
    index('claim_request_application_id_idx').on(table.applicationId),
    index('claim_request_user_id_idx').on(table.userId),
    index('claim_request_status_idx').on(table.status),
    foreignKey({
      columns: [table.applicationId],
      foreignColumns: [application.id],
      name: 'claim_request_application_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'claim_request_user_id_fkey',
    }).onDelete('cascade'),
  ],
);