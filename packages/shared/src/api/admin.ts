import { z } from 'zod';
import { DeviceSchema, EntitlementSchema } from './auth.ts';

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
  lastSeenAt: isoTime.nullable(),
  createdAt: isoTime,
});

export const AuditEntrySchema = z.object({
  id: z.string(),
  actor: z.object({ id: z.string(), email: z.string() }),
  action: z.string(),
  targetType: z.enum(['user', 'device', 'settings']),
  targetId: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  at: isoTime,
});

export const AdminUserDetailSchema = AdminUserSummarySchema.omit({ devices: true }).extend({
  suspendedReason: z.string().nullable(),
  entitlement: EntitlementSchema,
  devices: z.array(DeviceSchema),
  /** The latest audit entries about this user or their devices. */
  audit: z.array(AuditEntrySchema),
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
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
