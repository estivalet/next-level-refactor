import { z } from 'zod';

// Settings sync (FR-SET-5, D55): one document per kind and account, with a revision the server
// bumps on every write. The server stamps `updatedAt`, so a launcher's clock never decides.

export const SYNC_KINDS = ['settings', 'menus', 'collections', 'userState'] as const;
export type SyncKind = (typeof SYNC_KINDS)[number];

/** The most a document may weigh as JSON (the PUT body limit). */
export const SYNC_MAX_BYTES = 5 * 1024 * 1024;

export const SyncDocumentSchema = z.object({
  /** 0 when the kind was never written. */
  revision: z.number().int().min(0),
  data: z.unknown(),
  updatedAt: z.iso.datetime().nullable(),
});
export type SyncDocument = z.output<typeof SyncDocumentSchema>;

export const SyncPutRequestSchema = z.strictObject({
  /** The revision this write is based on; a newer one on the server → 409 with its copy. */
  baseRevision: z.number().int().min(0),
  data: z.unknown(),
});

export const SyncPutResponseSchema = z.object({
  revision: z.number().int().min(1),
  updatedAt: z.iso.datetime(),
});
