import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Service database (data model §5). Ids are uuid v7 strings; times are ISO-8601 UTC text.
// Keep the SQL portable (ADR-007: Postgres later is a dialect change).

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    googleSub: text('google_sub').notNull().unique(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),
    role: text('role', { enum: ['admin', 'subscriber'] })
      .notNull()
      .default('subscriber'),
    status: text('status', { enum: ['active', 'suspended'] })
      .notNull()
      .default('active'),
    suspendedReason: text('suspended_reason'),
    createdAt: text('created_at').notNull(),
    lastSeenAt: text('last_seen_at'),
  },
  (table) => [index('users_email').on(table.email)],
);

export const devices = sqliteTable(
  'devices',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    platform: text('platform').notNull(),
    appVersion: text('app_version').notNull(),
    createdAt: text('created_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
    revokedAt: text('revoked_at'),
  },
  (table) => [index('devices_user').on(table.userId)],
);

export const refreshTokens = sqliteTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id),
    /** SHA-256 hex of the token; the token itself is never stored. */
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    /** Set when the token was rotated; presenting it again is reuse. */
    replacedBy: text('replaced_by'),
    revokedAt: text('revoked_at'),
  },
  (table) => [index('refresh_tokens_device').on(table.deviceId)],
);

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  deviceLimit: integer('device_limit').notNull(),
  scopeIds: text('scope_ids', { mode: 'json' }).$type<string[]>().notNull(),
  stripePriceMonthly: text('stripe_price_monthly'),
  stripePriceYearly: text('stripe_price_yearly'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }),
});

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    targetType: text('target_type', { enum: ['user', 'device', 'settings'] }).notNull(),
    targetId: text('target_id').notNull(),
    before: text('before', { mode: 'json' }),
    after: text('after', { mode: 'json' }),
    at: text('at').notNull(),
  },
  (table) => [index('audit_log_at').on(table.at), index('audit_log_target').on(table.targetId)],
);

export const adminSessions = sqliteTable('admin_sessions', {
  id: text('id').primaryKey(),
  /** SHA-256 hex of the `nl_session` cookie value. */
  tokenHash: text('token_hash').notNull().unique(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
});
