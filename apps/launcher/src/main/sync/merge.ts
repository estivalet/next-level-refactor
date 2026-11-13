import { SYNC_TOMBSTONE_DAYS, type SyncEntries, type SyncEntry } from '@nextlevel/shared';
import { isDeepStrictEqual } from 'node:util';

/** The stamp of a PC's values at its first sync: anything the account already has wins. */
export const EPOCH = '1970-01-01T00:00:00.000Z';

const DAY_MS = 24 * 3600_000;

/**
 * What this PC has for one kind (D55). `values` are its current values. `holds(key)`: the key is
 * this PC's to change: a key it can't hold (another PC's play counter, a game it doesn't have)
 * is never stamped or removed from here. `subject(key)`: the game a key is about, if any.
 */
export interface LocalView {
  values: Map<string, unknown>;
  holds: (key: string) => boolean;
  subject: (key: string) => string | null;
}

/** The value an entry stands for; undefined for a tombstone or no entry. */
export function liveValue(entry: SyncEntry | undefined): unknown {
  return entry && !entry.deleted ? entry.value : undefined;
}

export const sameValue = (a: unknown, b: unknown) => isDeepStrictEqual(a, b);

/** Per entry, the newer `updatedAt` wins; equal stamps take `remote`. Old tombstones are dropped. */
export function mergeEntries(local: SyncEntries, remote: SyncEntries, now: Date): SyncEntries {
  const cutoff = now.getTime() - SYNC_TOMBSTONE_DAYS * DAY_MS;
  const merged: SyncEntries = {};
  for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const mine = local[key];
    const theirs = remote[key];
    const winner =
      !theirs || (mine && Date.parse(mine.updatedAt) > Date.parse(theirs.updatedAt))
        ? mine
        : theirs;
    if (!winner) continue;
    if (winner.deleted && Date.parse(winner.updatedAt) < cutoff) continue;
    merged[key] = winner;
  }
  return merged;
}

/**
 * The server stamps the document, not its entries: an entry can't be newer than the write that
 * stored it, so a PC whose clock runs ahead can't win every merge from then on.
 */
export function clampEntries(entries: SyncEntries, documentUpdatedAt: string | null): SyncEntries {
  if (documentUpdatedAt === null) return entries;
  const limit = Date.parse(documentUpdatedAt);
  const clamped: SyncEntries = {};
  for (const [key, entry] of Object.entries(entries)) {
    clamped[key] =
      Date.parse(entry.updatedAt) > limit ? { ...entry, updatedAt: documentUpdatedAt } : entry;
  }
  return clamped;
}

/** Now, or just after the copy being replaced when this PC's clock is behind it. */
function stamp(previous: SyncEntry | undefined, now: Date): string {
  const after = previous ? Date.parse(previous.updatedAt) + 1 : 0;
  return new Date(Math.max(now.getTime(), after)).toISOString();
}

/**
 * This PC's document: `base` (what it had after the last sync) with what changed here since.
 * A changed or new value is stamped now; a value gone from a key this PC holds leaves a
 * tombstone; keys it doesn't hold stay as they were. At the first sync every value is stamped
 * EPOCH. A game that appeared since the last sync (not in `held`) takes the document's entry,
 * so a game found again gets its state back instead of resetting it everywhere.
 */
export function stampLocal(
  base: SyncEntries,
  held: ReadonlySet<string>,
  view: LocalView,
  now: Date,
  first: boolean,
): SyncEntries {
  const local: SyncEntries = { ...base };
  const stampOf = (previous: SyncEntry | undefined) => (first ? EPOCH : stamp(previous, now));
  const fresh = (key: string) => {
    const subject = view.subject(key);
    return subject !== null && !held.has(subject);
  };
  for (const [key, value] of view.values) {
    const previous = base[key];
    if (sameValue(liveValue(previous), value)) continue;
    if (previous && fresh(key)) continue;
    local[key] = { value, updatedAt: stampOf(previous) };
  }
  for (const [key, previous] of Object.entries(base)) {
    if (previous.deleted || view.values.has(key) || !view.holds(key) || fresh(key)) continue;
    local[key] = { value: null, updatedAt: stampOf(previous), deleted: true };
  }
  return local;
}

/**
 * The keys whose value here differs from the merged document's and that this PC can apply
 * (`present`). This PC's own keys compare with its current values; the others with `base`.
 */
export function changedKeys(
  base: SyncEntries,
  merged: SyncEntries,
  view: LocalView,
  present: (key: string) => boolean,
): string[] {
  const keys = new Set([...Object.keys(base), ...Object.keys(merged), ...view.values.keys()]);
  return [...keys].filter((key) => {
    if (!present(key)) return false;
    const current = view.holds(key) ? view.values.get(key) : liveValue(base[key]);
    return !sameValue(current, liveValue(merged[key]));
  });
}

/** Whether two documents hold the same entries (nothing to write). */
export function sameEntries(a: SyncEntries, b: SyncEntries): boolean {
  return isDeepStrictEqual(a, b);
}
