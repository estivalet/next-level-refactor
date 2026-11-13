import { z } from 'zod';

/**
 * Why the last sync did not finish (D55). `offline`: no network or API; `subscription`: no
 * active subscription or the account is suspended; `deletedElsewhere`: another PC deleted the
 * synced data, so sync turned itself off here; `tooLarge`: a document is over 5 MiB.
 */
export const SYNC_ERRORS = [
  'offline',
  'subscription',
  'deletedElsewhere',
  'tooLarge',
  'conflict',
  'other',
] as const;
export type SyncError = (typeof SYNC_ERRORS)[number];

export const SyncStateSchema = z.object({
  enabled: z.boolean(),
  /** The last sync that finished, ISO; null = never on this PC. */
  lastSync: z.iso.datetime().nullable(),
  syncing: z.boolean(),
  error: z.enum(SYNC_ERRORS).nullable(),
});
export type SyncState = z.output<typeof SyncStateSchema>;

/** Settings → Sync channels (FR-SET-5, D55). */
export const syncContract = {
  'sync.state': { input: z.void(), output: SyncStateSchema },
  /** Opt-in per PC; turning it on syncs at once. */
  'sync.setEnabled': { input: z.strictObject({ enabled: z.boolean() }), output: SyncStateSchema },
  /** Sync now; answers the state after the sync. */
  'sync.now': { input: z.void(), output: SyncStateSchema },
  /** Delete synced data: clears the account's documents and turns sync off on this PC. */
  'sync.deleteRemote': { input: z.void(), output: SyncStateSchema },
} as const;

export const syncEvents = {
  'sync.changed': SyncStateSchema,
} as const;
