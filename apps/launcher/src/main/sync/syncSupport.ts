import {
  AppErrorException,
  type SyncEntries,
  type SyncError,
  type SyncStore,
} from '@nextlevel/shared';
import type { KindAdapter } from './documents.ts';
import { EPOCH, liveValue, sameValue, type LocalView } from './merge.ts';

export class DeletedElsewhere extends Error {}
export class StillConflicting extends Error {}

export const EMPTY_STORE: SyncStore = { v: 1, userId: null, lastSync: null, kinds: {} };

export function errorOf(error: unknown): SyncError {
  if (error instanceof DeletedElsewhere) return 'deletedElsewhere';
  if (error instanceof StillConflicting) return 'conflict';
  if (!(error instanceof AppErrorException)) return 'other';
  switch (error.error.code) {
    case 'API_UNREACHABLE':
    case 'UNAUTHENTICATED':
      return 'offline';
    case 'SUBSCRIPTION_REQUIRED':
    case 'SUSPENDED':
      return 'subscription';
    case 'PAYLOAD_TOO_LARGE':
      return 'tooLarge';
    case 'CONFLICT':
      return 'conflict';
    default:
      return 'other';
  }
}

/**
 * The store after Delete synced data: only the other PCs' play counters stay (`p:<key>|…`), so
 * this PC's plays can be told apart from theirs (its totals include them) if sync is turned on
 * again.
 */
export function keptAfterForget(store: SyncStore, deviceKey: string | null): SyncStore['kinds'] {
  const userState = store.kinds.userState;
  const others: SyncEntries = {};
  for (const [entryKey, entry] of Object.entries(userState?.entries ?? {})) {
    if (entryKey.startsWith('p:') && !entryKey.startsWith(`p:${deviceKey ?? ''}|`)) {
      others[entryKey] = entry;
    }
  }
  return userState ? { userState: { revision: 0, entries: others, held: userState.held } } : {};
}

/**
 * What this PC holds after applying `merged`. A value it couldn't apply (a name taken here, a
 * newer version's value) or applied only in part keeps this PC's own copy, stamped as the
 * merged entry: it is not a change made here, so the account's copy stays and is tried again.
 */
export function settle(merged: SyncEntries, keys: readonly string[], view: LocalView): SyncEntries {
  const settled: SyncEntries = { ...merged };
  for (const key of keys) {
    if (!view.holds(key)) continue;
    const here = view.values.get(key);
    if (sameValue(here, liveValue(merged[key]))) continue;
    const updatedAt = merged[key]?.updatedAt ?? EPOCH;
    settled[key] =
      here === undefined ? { value: null, updatedAt, deleted: true } : { value: here, updatedAt };
  }
  return settled;
}

/** The games the merged document is about that this PC has. */
export function held(merged: SyncEntries, read: ReturnType<KindAdapter['read']>): string[] {
  const subjects = new Set<string>();
  for (const key of Object.keys(merged)) {
    const subject = read.view.subject(key);
    if (subject !== null && read.hasSubject(subject)) subjects.add(subject);
  }
  return [...subjects];
}
