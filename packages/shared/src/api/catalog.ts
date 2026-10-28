import { z } from 'zod';
import { CATALOG_SLUG, CATALOG_SLUG_MAX, safeFilename } from '../catalog/filename.ts';
import { SYSTEM_ID } from '../catalog/schema.ts';
import { GAME_ART_KINDS } from '../frontend/schema.ts';

// Catalog contracts (api-spec Catalog and Admin catalog, data model §5, content policy, M9).

const isoTime = z.iso.datetime();
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const LICENSE_TYPES = [
  'author-permission',
  'freeware',
  'open-source',
  'public-domain',
  'commercial-license',
] as const;
/** What an installed copy does when its item leaves the catalog (FR-CAT-7, D43). */
export const ON_LAPSE = ['keep', 'remove'] as const;
export const FILE_ROLES = ['rom', 'disc', 'extra'] as const;
export const ITEM_STATUS = ['draft', 'published', 'unpublished'] as const;
/** Why an item can't be published yet (C10, D44). */
export const PUBLISH_BLOCKERS = [
  'license',
  'licenseUnverified',
  'licenseNotStarted',
  'licenseExpired',
  'onLapse',
  'files',
] as const;

export const CatalogSlugSchema = z.string().max(CATALOG_SLUG_MAX).regex(CATALOG_SLUG);
export const LicenseTypeSchema = z.enum(LICENSE_TYPES);
export const OnLapseSchema = z.enum(ON_LAPSE);
export const FileRoleSchema = z.enum(FILE_ROLES);
export const ItemStatusSchema = z.enum(ITEM_STATUS);
export const PublishBlockerSchema = z.enum(PUBLISH_BLOCKERS);
export const CatalogMediaKindSchema = z.enum(GAME_ART_KINDS);

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);

// --- Admin -------------------------------------------------------------------------------------

export const LicenseInputSchema = z.strictObject({
  type: LicenseTypeSchema,
  rightsHolder: required(200),
  contact: required(200),
  terms: required(4000),
  territories: z.array(required(60)).max(250).optional(),
  startsAt: isoTime.optional(),
  expiresAt: isoTime.optional(),
});

export const AdminLicenseSchema = z.object({
  id: z.string(),
  type: LicenseTypeSchema,
  rightsHolder: z.string(),
  contact: z.string(),
  terms: z.string(),
  territories: z.array(z.string()).nullable(),
  startsAt: isoTime.nullable(),
  expiresAt: isoTime.nullable(),
  evidenceFilename: z.string().nullable(),
  verifiedBy: z.object({ id: z.string(), email: z.string() }).nullable(),
  verifiedAt: isoTime.nullable(),
});

export const AdminCatalogFileSchema = z.object({
  id: z.string(),
  filename: z.string(),
  size: z.number().int().min(0),
  sha256: z.string(),
  role: FileRoleSchema,
  status: z.enum(['pending', 'ready']),
  createdAt: isoTime,
});

export const AdminCatalogMediaSchema = z.object({
  kind: CatalogMediaKindSchema,
  size: z.number().int().min(0),
  sha256: z.string(),
  version: z.number().int().min(1),
});

export const AdminCatalogItemSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  systemId: z.string(),
  scopeSlug: z.string(),
  status: ItemStatusSchema,
  starter: z.boolean(),
  version: z.number().int().min(1),
  publishedAt: isoTime.nullable(),
  updatedAt: isoTime,
});

export const AdminCatalogItemSchema = AdminCatalogItemSummarySchema.extend({
  description: z.string(),
  year: z.number().int().nullable(),
  developer: z.string(),
  publisher: z.string(),
  genre: z.string(),
  players: z.number().int().nullable(),
  onLapse: OnLapseSchema.nullable(),
  license: AdminLicenseSchema.nullable(),
  files: z.array(AdminCatalogFileSchema),
  media: z.array(AdminCatalogMediaSchema),
  /** Empty when the item can be published. */
  publishBlockers: z.array(PublishBlockerSchema),
  createdAt: isoTime,
});

export const AdminCatalogPageSchema = z.object({
  items: z.array(AdminCatalogItemSummarySchema),
  nextCursor: z.string().nullable(),
});

export const AdminCatalogQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: ItemStatusSchema.optional(),
  system: z.string().regex(SYSTEM_ID).optional(),
  scope: CatalogSlugSchema.optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const CreateItemSchema = z.strictObject({
  slug: CatalogSlugSchema,
  title: required(200),
  systemId: z.string().regex(SYSTEM_ID),
  scopeSlug: CatalogSlugSchema,
});

export const UpdateItemSchema = z
  .strictObject({
    title: required(200),
    description: text(4000),
    year: z.number().int().min(1950).max(2100).nullable(),
    developer: text(200),
    publisher: text(200),
    genre: text(100),
    players: z.number().int().min(1).max(16).nullable(),
    scopeSlug: CatalogSlugSchema,
    onLapse: OnLapseSchema,
    starter: z.boolean(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, { message: 'empty' });

export const StartUploadSchema = z.strictObject({
  filename: z.string().refine((name) => safeFilename(name), { message: 'filename' }),
  role: FileRoleSchema,
});

export const StartUploadResponseSchema = z.object({ fileId: z.string(), uploadUrl: z.string() });
export const UploadResultSchema = z.object({ size: z.number().int().min(0), sha256: z.string() });
export const CompleteUploadSchema = z.strictObject({ sha256: sha256.optional() });

// --- Subscriber --------------------------------------------------------------------------------

export const CatalogQuerySchema = z.object({
  system: z.string().regex(SYSTEM_ID).optional(),
  genre: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  /** `true`: only the Starter set (D46). */
  starter: z.enum(['true', 'false']).optional(),
  scope: CatalogSlugSchema.optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const CatalogItemSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  systemId: z.string(),
  scope: z.string(),
  year: z.number().int().nullable(),
  genre: z.string(),
  /** Bytes of all its files. */
  size: z.number().int().min(0),
  license: z.object({ type: LicenseTypeSchema, rightsHolder: z.string() }),
  starter: z.boolean(),
  version: z.number().int().min(1),
  boxArt: z.string().nullable(),
});

export const CatalogFileSchema = z.object({
  id: z.string(),
  filename: z.string(),
  size: z.number().int().min(0),
  sha256: z.string(),
  role: FileRoleSchema,
});

export const CatalogItemSchema = CatalogItemSummarySchema.extend({
  description: z.string(),
  developer: z.string(),
  publisher: z.string(),
  players: z.number().int().nullable(),
  files: z.array(CatalogFileSchema),
  media: z.array(z.object({ kind: CatalogMediaKindSchema, url: z.string() })),
  license: z.object({ type: LicenseTypeSchema, rightsHolder: z.string(), terms: z.string() }),
});

export const CatalogPageSchema = z.object({
  items: z.array(CatalogItemSummarySchema),
  nextCursor: z.string().nullable(),
});

export const DownloadRequestSchema = z.strictObject({ deviceId: z.string().min(1).max(100) });

export const DownloadGrantSchema = z.object({
  files: z.array(
    z.object({
      fileId: z.string(),
      filename: z.string(),
      size: z.number().int().min(0),
      sha256: z.string(),
      url: z.string(),
      expiresAt: isoTime,
    }),
  ),
});

export const InstallStatusRequestSchema = z.strictObject({
  items: z
    .array(z.object({ id: z.string().min(1).max(100), version: z.number().int().min(1) }))
    .max(5000),
});

/** `gone`: unpublished, license expired, outside the player's scopes, or unknown. */
export const InstallStatusSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      state: z.enum(['current', 'update', 'gone']),
      version: z.number().int().min(1).nullable(),
      onLapse: OnLapseSchema.nullable(),
    }),
  ),
});

export type LicenseType = z.output<typeof LicenseTypeSchema>;
export type OnLapse = z.output<typeof OnLapseSchema>;
export type FileRole = z.output<typeof FileRoleSchema>;
export type ItemStatus = z.output<typeof ItemStatusSchema>;
export type PublishBlocker = z.output<typeof PublishBlockerSchema>;
export type CatalogMediaKind = z.output<typeof CatalogMediaKindSchema>;
export type LicenseInput = z.output<typeof LicenseInputSchema>;
export type AdminLicense = z.output<typeof AdminLicenseSchema>;
export type AdminCatalogFile = z.output<typeof AdminCatalogFileSchema>;
export type AdminCatalogMedia = z.output<typeof AdminCatalogMediaSchema>;
export type AdminCatalogItemSummary = z.output<typeof AdminCatalogItemSummarySchema>;
export type AdminCatalogItem = z.output<typeof AdminCatalogItemSchema>;
export type AdminCatalogPage = z.output<typeof AdminCatalogPageSchema>;
export type AdminCatalogQuery = z.output<typeof AdminCatalogQuerySchema>;
export type CreateItem = z.output<typeof CreateItemSchema>;
export type UpdateItem = z.output<typeof UpdateItemSchema>;
export type StartUpload = z.output<typeof StartUploadSchema>;
export type CatalogQuery = z.output<typeof CatalogQuerySchema>;
export type CatalogItemSummary = z.output<typeof CatalogItemSummarySchema>;
export type CatalogItem = z.output<typeof CatalogItemSchema>;
export type CatalogPage = z.output<typeof CatalogPageSchema>;
export type DownloadGrant = z.output<typeof DownloadGrantSchema>;
export type InstallStatusRequest = z.output<typeof InstallStatusRequestSchema>;
export type InstallStatus = z.output<typeof InstallStatusSchema>;
