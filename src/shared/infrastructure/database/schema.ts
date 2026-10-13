import {
  pgTable,
  pgEnum,
  foreignKey,
  serial,
  varchar,
  integer,
  text,
  timestamp,
  boolean,
  doublePrecision,
  primaryKey,
  check,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const claimRequestStatus = pgEnum('claim_request_status', ['PENDING', 'APPROVED', 'DECLINED']);

export const applicationApprovalStatus = pgEnum('application_approval_status', [
  'PENDING',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REMOVED',
]);

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  website: text('website'),
  logo: text('logo'),
  role: text('role'),
  banned: boolean('banned'),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { precision: 6, withTimezone: true }),
  tosAccepted: boolean('tos_accepted').default(false).notNull(),
  tosAcceptedAt: timestamp('tos_accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

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

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    impersonatedBy: text('impersonated_by'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('account_user_id_idx').on(table.userId),
    unique('account_provider_account_unq').on(table.providerId, table.accountId),
  ],
);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const rating = pgTable(
  'rating',
  {
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
