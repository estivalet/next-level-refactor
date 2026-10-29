import { z } from 'zod';
import {
  CatalogItemSchema,
  CatalogItemSummarySchema,
  CatalogQuerySchema,
  OnLapseSchema,
} from '../api/catalog.ts';

// Launcher catalog channels (FR-CAT-3..7, US-E1..E3, D42, D43). Spread into `ipcContract`; main
// calls the API, the renderer only sees these.

/** Where an item stands on this PC. `gone`: installed, but it left the catalog (kept). */
export const INSTALL_STATES = [
  'none',
  'queued',
  'downloading',
  'installed',
  'update',
  'gone',
  'failed',
] as const;
export const DOWNLOAD_STATES = ['queued', 'downloading', 'paused', 'failed', 'done'] as const;
/** `network`: the connection dropped (resumes by itself); `offline`: signed out or no API. */
export const PAUSED_REASONS = ['user', 'network', 'offline'] as const;
/** `DOWNLOAD_FAILED` `details.reason` and a failed download's `error`. */
export const DOWNLOAD_FAILURES = ['checksum', 'diskFull', 'network', 'refused', 'write'] as const;

export const InstallStateSchema = z.enum(INSTALL_STATES);
export const DownloadStateSchema = z.enum(DOWNLOAD_STATES);
export const PausedReasonSchema = z.enum(PAUSED_REASONS);
export const DownloadFailureSchema = z.enum(DOWNLOAD_FAILURES);

const itemId = z.string().min(1).max(100);
const downloadId = z.string().min(1).max(100);
const bytes = z.number().int().min(0);

export const CatalogListItemSchema = CatalogItemSummarySchema.extend({
  installState: InstallStateSchema,
});

export const CatalogListPageSchema = z.object({
  items: z.array(CatalogListItemSchema),
  nextCursor: z.string().nullable(),
});

export const CatalogDetailSchema = CatalogItemSchema.extend({ installState: InstallStateSchema });

export const DownloadSummarySchema = z.object({
  id: z.string(),
  itemId: z.string(),
  title: z.string(),
  systemId: z.string(),
  version: z.number().int().min(1),
  state: DownloadStateSchema,
  pausedReason: PausedReasonSchema.nullable(),
  bytesDone: bytes,
  bytesTotal: bytes,
  error: DownloadFailureSchema.nullable(),
  createdAt: z.iso.datetime(),
});

export const InstalledItemSchema = z.object({
  itemId: z.string(),
  gameId: z.number().int().positive(),
  title: z.string(),
  systemId: z.string(),
  version: z.number().int().min(1),
  /** `update`: a newer version is published (D42); `gone`: left the catalog, kept (D43). */
  state: z.enum(['current', 'update', 'gone']),
  onLapse: OnLapseSchema,
  installedAt: z.iso.datetime(),
});

export const catalogContract = {
  'catalog.list': { input: CatalogQuerySchema, output: CatalogListPageSchema },
  'catalog.get': { input: z.strictObject({ itemId }), output: CatalogDetailSchema },
  /** Queues a download (also Update, D42); the install happens when it finishes. */
  'catalog.install': { input: z.strictObject({ itemId }), output: DownloadSummarySchema },
  /** `confirm`: also when the game is a favorite or in a collection (US-E3). */
  'catalog.uninstall': {
    input: z.strictObject({ itemId, confirm: z.boolean().default(false) }),
    output: z.void(),
  },
  'catalog.installed': { input: z.void(), output: z.array(InstalledItemSchema) },
  'downloads.list': { input: z.void(), output: z.array(DownloadSummarySchema) },
  'downloads.pause': { input: z.strictObject({ downloadId }), output: z.void() },
  'downloads.resume': { input: z.strictObject({ downloadId }), output: z.void() },
  /** Removes the download and its partial files. */
  'downloads.cancel': { input: z.strictObject({ downloadId }), output: z.void() },
} as const;

export const catalogEvents = {
  /** At most 4 a second per download. */
  'downloads.progress': z.object({
    downloadId: z.string(),
    itemId: z.string(),
    bytesDone: bytes,
    bytesTotal: bytes,
    state: DownloadStateSchema,
  }),
  'downloads.finished': z.object({
    downloadId: z.string(),
    itemId: z.string(),
    result: z.enum(['installed', 'failed', 'cancelled']),
    error: DownloadFailureSchema.optional(),
  }),
  /** Installed games removed because their items left the catalog with `on_lapse: remove`. */
  'catalog.removed': z.object({ titles: z.array(z.string()) }),
} as const;

export type InstallState = z.output<typeof InstallStateSchema>;
export type DownloadState = z.output<typeof DownloadStateSchema>;
export type PausedReason = z.output<typeof PausedReasonSchema>;
export type DownloadFailure = z.output<typeof DownloadFailureSchema>;
export type CatalogListItem = z.output<typeof CatalogListItemSchema>;
export type CatalogListPage = z.output<typeof CatalogListPageSchema>;
export type CatalogDetail = z.output<typeof CatalogDetailSchema>;
export type DownloadSummary = z.output<typeof DownloadSummarySchema>;
export type InstalledItem = z.output<typeof InstalledItemSchema>;
