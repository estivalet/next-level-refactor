import { z } from 'zod';
import { DeviceSchema, EntitlementSchema } from './auth.ts';
import {
  BillingIntervalSchema,
  PlanPricesSchema,
  PlanSlugSchema,
  SubscriptionSummarySchema,
} from './billing.ts';

// Admin console contracts (api-spec §2 Admin, FR-ADM-1, FR-ADM-5).

const isoTime = z.iso.datetime();
const role = z.enum(['admin', 'subscriber']);
const userStatus = z.enum(['active', 'suspended']);

/** One page of a cursor-paginated list. */
export function PageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}

export const AdminUserSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  role,
  status: userStatus,
  /** Devices not revoked. */
  devices: z.number().int().min(0),
  /** The plan of the user's entitlement now; null for admins and users without access. */
  plan: z.object({ slug: z.string(), name: z.string() }).nullable(),
  lastSeenAt: isoTime.nullable(),
  createdAt: isoTime,
});

export const AuditEntrySchema = z.object({
  id: z.string(),
  actor: z.object({ id: z.string(), email: z.string() }),
  action: z.string(),
  targetType: z.enum(['user', 'device', 'settings', 'plan', 'scope', 'subscription']),
  targetId: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  at: isoTime,
});

export const AdminPlanSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  deviceLimit: z.number().int().positive(),
  scopeIds: z.array(z.string()),
  stripePriceMonthly: z.string().nullable(),
  stripePriceYearly: z.string().nullable(),
  prices: PlanPricesSchema,
  archived: z.boolean(),
  /** Access-giving subscriptions and comp grants on this plan. */
  subscribers: z.number().int().min(0),
});

const stripePriceId = z.string().trim().min(1).max(200).nullable().optional();

export const AdminPlanCreateSchema = z.strictObject({
  slug: PlanSlugSchema,
  name: z.string().trim().min(1).max(60),
  deviceLimit: z.number().int().min(1).max(20),
  scopeIds: z.array(z.string().min(1).max(100)).max(50),
  stripePriceMonthly: stripePriceId,
  stripePriceYearly: stripePriceId,
});

export const AdminPlanPatchSchema = AdminPlanCreateSchema.omit({ slug: true })
  .partial()
  .extend({ archived: z.boolean().optional() });

export const CatalogScopeSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
});

export const CatalogScopeCreateSchema = z.strictObject({
  slug: PlanSlugSchema,
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500),
});

export const CatalogScopePatchSchema = CatalogScopeCreateSchema.omit({ slug: true }).partial();

/** A complimentary grant (D35): null `expiresAt` = until revoked. */
export const GrantRequestSchema = z.strictObject({
  planSlug: PlanSlugSchema,
  expiresAt: isoTime.nullable(),
  note: z.string().trim().min(1).max(500),
});

export const AdminSubscriptionSchema = z.object({
  id: z.string(),
  source: SubscriptionSummarySchema.shape.source,
  status: SubscriptionSummarySchema.shape.status,
  plan: z.object({ slug: z.string(), name: z.string() }),
  periodEnd: isoTime.nullable(),
  cancelAtPeriodEnd: z.boolean(),
  interval: BillingIntervalSchema.nullable(),
  stripeSubscriptionId: z.string().nullable(),
  grantedBy: z.object({ id: z.string(), email: z.string() }).nullable(),
  note: z.string().nullable(),
  createdAt: isoTime,
});

export const AdminUserDetailSchema = AdminUserSummarySchema.omit({ devices: true }).extend({
  suspendedReason: z.string().nullable(),
  entitlement: EntitlementSchema,
  devices: z.array(DeviceSchema),
  /** The latest audit entries about this user or their devices. */
  audit: z.array(AuditEntrySchema),
  /** Stripe subscriptions and comp grants, newest first. */
  subscriptions: z.array(AdminSubscriptionSchema),
});

export const AdminUserPatchSchema = z
  .strictObject({
    role: role.optional(),
    status: userStatus.optional(),
    suspendedReason: z.string().trim().min(1).max(500).optional(),
  })
  .refine((patch) => patch.status !== 'suspended' || patch.suspendedReason !== undefined, {
    message: 'A suspension needs a reason.',
    path: ['suspendedReason'],
  });

export const AdminUserQuerySchema = z.strictObject({
  q: z.string().trim().max(200).optional(),
  status: userStatus.optional(),
  plan: PlanSlugSchema.optional(),
  /** `comp` = an active complimentary grant; the others are entitlement statuses. */
  access: z.enum(['active', 'grace', 'none', 'comp']).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const AuditQuerySchema = z.strictObject({
  actor: z.string().max(100).optional(),
  target: z.string().max(100).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type AdminUserSummary = z.output<typeof AdminUserSummarySchema>;
export type AdminUserDetail = z.output<typeof AdminUserDetailSchema>;
export type AdminUserPatch = z.output<typeof AdminUserPatchSchema>;
export type AdminUserQuery = z.output<typeof AdminUserQuerySchema>;
export type AuditEntry = z.output<typeof AuditEntrySchema>;
export type AuditQuery = z.output<typeof AuditQuerySchema>;
export type AdminPlan = z.output<typeof AdminPlanSchema>;
export type AdminPlanCreate = z.output<typeof AdminPlanCreateSchema>;
export type AdminPlanPatch = z.output<typeof AdminPlanPatchSchema>;
export type CatalogScope = z.output<typeof CatalogScopeSchema>;
export type CatalogScopeCreate = z.output<typeof CatalogScopeCreateSchema>;
export type CatalogScopePatch = z.output<typeof CatalogScopePatchSchema>;
export type GrantRequest = z.output<typeof GrantRequestSchema>;
export type AdminSubscription = z.output<typeof AdminSubscriptionSchema>;
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
