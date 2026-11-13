import {
  SmartFilterQuerySchema,
  SyncCollectionSchema,
  SyncMemberSchema,
  SyncSmartFilterSchema,
  type SyncEntries,
} from '@nextlevel/shared';
import type { LibraryDb } from '../library/openLibrary.ts';
import { gameIndex, splitKey, type KindAdapter } from './documents.ts';
import { liveValue } from './merge.ts';

type Table = 'collections' | 'smart_filters';

interface Row {
  id: number;
  name: string;
  syncId: string | null;
}

/**
 * Positions for a collection's games in their order here. Games the last sync knew keep their
 * position while their order still matches it; new ones go between their neighbours, so a game
 * another PC added (and that isn't here) keeps its place. A reorder renumbers 0..n-1.
 */
export function positionsFor(
  order: readonly string[],
  known: ReadonlyMap<string, number>,
): Map<string, number> {
  const knownPositions = order.filter((key) => known.has(key)).map((key) => known.get(key) ?? 0);
  const consistent = knownPositions.every((p, i) => i === 0 || p > (knownPositions[i - 1] ?? 0));
  if (!consistent) return new Map(order.map((key, index) => [key, index]));
  const result = new Map<string, number>();
  let i = 0;
  while (i < order.length) {
    const key = order[i] ?? '';
    const position = known.get(key);
    if (position !== undefined) {
      result.set(key, position);
      i += 1;
      continue;
    }
    let j = i;
    while (j < order.length && !known.has(order[j] ?? '')) j += 1;
    const count = j - i;
    const before = i > 0 ? result.get(order[i - 1] ?? '') : undefined;
    const after = j < order.length ? known.get(order[j] ?? '') : undefined;
    const lo = before ?? (after !== undefined ? after - count - 1 : -1);
    const hi = after ?? lo + count + 1;
    const step = (hi - lo) / (count + 1);
    for (let k = 0; k < count; k += 1) result.set(order[i + k] ?? '', lo + step * (k + 1));
    i = j;
  }
  return result;
}

export interface CollectionsDocDeps {
  db: LibraryDb;
  newId: () => string;
  clock: () => Date;
  /** A collection or smart filter changed (menus.changed, library views). */
  changed: () => void;
  log: { warn(context: object, msg: string): void };
}

/**
 * The `collections` document (D55): each collection (`c:`), each of its games (`m:`, by game key,
 * so a rename on one PC and an add on another both survive), and each smart filter (`f:`). Sync
 * ids are given on first read; a collection or filter another PC made with the same name as one
 * here that never synced becomes the same one.
 */
export function collectionsDoc(deps: CollectionsDocDeps): KindAdapter {
  const client = deps.db.$client;
  const rows = (table: Table) =>
    client.prepare(`select id, name, sync_id as syncId from ${table} order by id`).all() as Row[];

  /** Gives missing sync ids, adopting the account's id for a same-named, never-synced row. */
  function ensureIds(table: Table, prefix: string, base: SyncEntries, remote: SyncEntries) {
    const setId = client.prepare(`update ${table} set sync_id = ? where id = ?`);
    const local = rows(table);
    const taken = new Set(local.map((row) => row.syncId));
    const unsynced = (row: Row) => row.syncId === null || !(`${prefix}${row.syncId}` in base);
    for (const [key, entry] of Object.entries(remote)) {
      if (!key.startsWith(prefix) || key.includes('|') || entry.deleted) continue;
      const syncId = key.slice(prefix.length);
      if (taken.has(syncId)) continue;
      const name = (entry.value as { name?: unknown } | null)?.name;
      if (typeof name !== 'string') continue;
      const match = local.find(
        (row) => row.name.toLowerCase() === name.toLowerCase() && unsynced(row),
      );
      if (!match) continue;
      setId.run(syncId, match.id);
      taken.delete(match.syncId);
      match.syncId = syncId;
      taken.add(syncId);
    }
    for (const row of local) if (row.syncId === null) setId.run(deps.newId(), row.id);
  }

  return {
    read(base, remote) {
      client.transaction(() => {
        ensureIds('collections', 'c:', base, remote);
        ensureIds('smart_filters', 'f:', base, remote);
      })();
      const games = gameIndex(deps.db);
      const keyOf = new Map([...games].map(([key, id]) => [id, key]));
      const values = new Map<string, unknown>();
      const collections = client
        .prepare('select id, name, sort, sync_id as syncId from collections')
        .all() as Array<Row & { sort: string; syncId: string }>;
      const members = client.prepare(
        'select game_id from collection_games where collection_id = ? order by position',
      );
      for (const row of collections) {
        values.set(`c:${row.syncId}`, { name: row.name, sort: row.sort });
        const order = (members.pluck().all(row.id) as number[])
          .map((gameId) => keyOf.get(gameId))
          .filter((key) => key !== undefined);
        const known = new Map<string, number>();
        for (const game of order) {
          const position = SyncMemberSchema.safeParse(liveValue(base[`m:${row.syncId}|${game}`]));
          if (position.success) known.set(game, position.data.position);
        }
        for (const [game, position] of positionsFor(order, known)) {
          values.set(`m:${row.syncId}|${game}`, { position });
        }
      }
      const filters = client
        .prepare('select name, query, sync_id as syncId from smart_filters')
        .all() as Array<{ name: string; query: string; syncId: string }>;
      for (const row of filters) {
        values.set(`f:${row.syncId}`, { name: row.name, query: JSON.parse(row.query) as unknown });
      }
      const subject = (key: string) => splitKey(key, 'm:')?.[1] ?? null;
      const present = (key: string) => {
        const game = subject(key);
        return game === null || games.has(game);
      };
      return {
        view: { values, holds: present, subject },
        present,
        hasSubject: (game) => games.has(game),
      };
    },
    apply(merged, keys) {
      if (keys.length === 0) return;
      const now = deps.clock().toISOString();
      client.transaction(() => {
        applyRows(merged, keys, 'f:', 'smart_filters', now);
        applyRows(merged, keys, 'c:', 'collections', now);
        applyMembers(merged, keys);
      })();
      deps.changed();
    },
  };

  function applyRows(
    merged: SyncEntries,
    keys: readonly string[],
    prefix: string,
    table: Table,
    now: string,
  ) {
    for (const key of keys) {
      if (!key.startsWith(prefix) || key.includes('|')) continue;
      const syncId = key.slice(prefix.length);
      const value = liveValue(merged[key]);
      if (value === undefined) {
        client.prepare(`delete from ${table} where sync_id = ?`).run(syncId);
        continue;
      }
      const fields = table === 'collections' ? collectionFields(value) : smartFilterFields(value);
      if (!fields) continue;
      const names = Object.keys(fields);
      try {
        const updated = client
          .prepare(
            `update ${table} set ${names.map((name) => `${name} = @${name}`).join(', ')}
             where sync_id = @syncId`,
          )
          .run({ ...fields, syncId });
        if (updated.changes === 0) {
          client
            .prepare(
              `insert into ${table} (${names.join(', ')}, created_at, sync_id)
               values (${names.map((name) => `@${name}`).join(', ')}, @now, @syncId)`,
            )
            .run({ ...fields, now, syncId });
        }
      } catch (error) {
        // Another collection here already has that name: this one keeps its own until renamed.
        deps.log.warn({ error, table }, 'a synced collection or filter was not applied');
      }
    }
  }

  function applyMembers(merged: SyncEntries, keys: readonly string[]) {
    const affected = new Set<string>();
    for (const key of keys) {
      const member = splitKey(key, 'm:');
      if (member) affected.add(member[0]);
      else if (key.startsWith('c:') && liveValue(merged[key]) !== undefined)
        affected.add(key.slice(2));
    }
    if (affected.size === 0) return;
    const games = gameIndex(deps.db);
    const wanted = new Map<string, Array<{ gameId: number; position: number; key: string }>>();
    for (const [key, entry] of Object.entries(merged)) {
      const member = splitKey(key, 'm:');
      if (!member || !affected.has(member[0])) continue;
      const gameId = games.get(member[1]);
      const position = SyncMemberSchema.safeParse(liveValue(entry));
      if (gameId === undefined || !position.success) continue;
      const list = wanted.get(member[0]) ?? [];
      list.push({ gameId, position: position.data.position, key });
      wanted.set(member[0], list);
    }
    const idOf = client.prepare('select id from collections where sync_id = ?').pluck();
    const clear = client.prepare('delete from collection_games where collection_id = ?');
    const insert = client.prepare(
      'insert or ignore into collection_games (collection_id, game_id, position) values (?, ?, ?)',
    );
    for (const syncId of affected) {
      const collectionId = idOf.get(syncId) as number | undefined;
      if (collectionId === undefined) continue;
      clear.run(collectionId);
      const list = (wanted.get(syncId) ?? []).sort(
        (a, b) => a.position - b.position || a.key.localeCompare(b.key),
      );
      list.forEach((member, index) => insert.run(collectionId, member.gameId, index));
    }
  }
}

function collectionFields(value: unknown) {
  const parsed = SyncCollectionSchema.safeParse(value);
  return parsed.success ? { name: parsed.data.name, sort: parsed.data.sort } : null;
}

function smartFilterFields(value: unknown) {
  const parsed = SyncSmartFilterSchema.safeParse(value);
  if (!parsed.success) return null;
  const query = SmartFilterQuerySchema.safeParse(parsed.data.query);
  return query.success ? { name: parsed.data.name, query: JSON.stringify(query.data) } : null;
}
