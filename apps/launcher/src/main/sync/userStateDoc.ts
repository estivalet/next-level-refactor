import {
  SyncFlagsSchema,
  SyncPlaysSchema,
  type SyncEntries,
  type SyncFlags,
  type SyncPlays,
} from '@nextlevel/shared';
import type { LibraryDb } from '../library/openLibrary.ts';
import { gameIndex, splitKey, type KindAdapter } from './documents.ts';
import { liveValue } from './merge.ts';

interface StateRow {
  gameId: number;
  favorite: number;
  hidden: number;
  completed: number;
  userRating: number | null;
  playCount: number;
  playSeconds: number;
  lastPlayedAt: string | null;
}

const NO_FLAGS: SyncFlags = { favorite: false, hidden: false, completed: false, userRating: null };

const latest = (a: string | null, b: string | null) =>
  a === null ? b : b === null || a > b ? a : b;

/** The game a `g:` or `p:` key is about. */
function gameOf(key: string): string | null {
  if (key.startsWith('g:')) return key.slice(2);
  return splitKey(key, 'p:')?.[1] ?? null;
}

/** Sums of every other PC's counters per game, from the last synced document. */
function otherPlays(base: SyncEntries, deviceKey: string) {
  const sums = new Map<string, SyncPlays>();
  for (const [key, entry] of Object.entries(base)) {
    const parts = splitKey(key, 'p:');
    if (!parts || parts[0] === deviceKey) continue;
    const plays = SyncPlaysSchema.safeParse(liveValue(entry));
    if (!plays.success) continue;
    const sum = sums.get(parts[1]) ?? { count: 0, seconds: 0, lastPlayedAt: null };
    sums.set(parts[1], {
      count: sum.count + plays.data.count,
      seconds: sum.seconds + plays.data.seconds,
      lastPlayedAt: latest(sum.lastPlayedAt, plays.data.lastPlayedAt),
    });
  }
  return sums;
}

/**
 * The `userState` document (D55): favorite, hidden, completed and rating per game (`g:`), and
 * each PC's own play counter (`p:<deviceKey>|`), so counts and time add up across PCs and this
 * PC's counter only changes here. Locally `play_count` / `play_seconds` are the sum over PCs and
 * `last_played_at` the latest; this PC's share is the total minus the other PCs' counters. State
 * for a game this PC doesn't have waits in the document until a scan adds it.
 */
export interface UserStateDocDeps {
  db: LibraryDb;
  /** This PC's settings.sync.deviceKey. */
  deviceKey: () => string;
  /** The games whose state changed (library.changed). */
  changed: (gameIds: number[]) => void;
}

export function userStateDoc({ db, deviceKey, changed }: UserStateDocDeps): KindAdapter {
  return {
    read(base) {
      const me = deviceKey();
      const games = gameIndex(db);
      const keyOf = new Map([...games].map(([key, id]) => [id, key]));
      const others = otherPlays(base, me);
      const values = new Map<string, unknown>();
      const rows = db.$client
        .prepare(
          `select game_id as gameId, favorite, hidden, completed, user_rating as userRating,
             play_count as playCount, play_seconds as playSeconds, last_played_at as lastPlayedAt
           from game_user_state`,
        )
        .all() as StateRow[];
      for (const row of rows) {
        const game = keyOf.get(row.gameId);
        if (game === undefined) continue;
        const flags: SyncFlags = {
          favorite: row.favorite === 1,
          hidden: row.hidden === 1,
          completed: row.completed === 1,
          userRating: row.userRating,
        };
        if (flags.favorite || flags.hidden || flags.completed || flags.userRating !== null) {
          values.set(`g:${game}`, flags);
        }
        const other = others.get(game);
        const ownKey = `p:${me}|${game}`;
        const count = Math.max(0, row.playCount - (other?.count ?? 0));
        const seconds = Math.max(0, row.playSeconds - (other?.seconds ?? 0));
        const before = SyncPlaysSchema.safeParse(liveValue(base[ownKey]));
        const playedHere =
          row.lastPlayedAt !== null &&
          (other?.lastPlayedAt == null || row.lastPlayedAt > other.lastPlayedAt);
        if (count === 0 && seconds === 0 && !playedHere) continue;
        const lastPlayedAt = playedHere
          ? row.lastPlayedAt
          : before.success
            ? before.data.lastPlayedAt
            : row.lastPlayedAt;
        values.set(ownKey, { count, seconds, lastPlayedAt });
      }
      const present = (key: string) => {
        const game = gameOf(key);
        return game !== null && games.has(game);
      };
      return {
        view: {
          values,
          holds: (key) => present(key) && (key.startsWith('g:') || key.startsWith(`p:${me}|`)),
          subject: gameOf,
        },
        present,
        hasSubject: (game) => games.has(game),
      };
    },
    apply(merged, keys) {
      const touched = new Set(keys.map(gameOf).filter((game) => game !== null));
      if (touched.size === 0) return;
      const games = gameIndex(db);
      const playsOf = new Map<string, SyncPlays[]>();
      for (const [key, entry] of Object.entries(merged)) {
        const game = splitKey(key, 'p:')?.[1];
        if (game === undefined || !touched.has(game)) continue;
        const plays = SyncPlaysSchema.safeParse(liveValue(entry));
        if (plays.success) playsOf.set(game, [...(playsOf.get(game) ?? []), plays.data]);
      }
      const ids: number[] = [];
      const upsert = db.$client.prepare(
        `insert into game_user_state (game_id, favorite, hidden, completed, user_rating, play_count,
           play_seconds, last_played_at)
         values (@gameId, @favorite, @hidden, @completed, @userRating, @count, @seconds, @last)
         on conflict (game_id) do update set favorite = excluded.favorite,
           hidden = excluded.hidden, completed = excluded.completed,
           user_rating = excluded.user_rating, play_count = excluded.play_count,
           play_seconds = excluded.play_seconds, last_played_at = excluded.last_played_at`,
      );
      db.$client.transaction(() => {
        for (const game of touched) {
          const gameId = games.get(game);
          if (gameId === undefined) continue;
          const parsed = SyncFlagsSchema.safeParse(liveValue(merged[`g:${game}`]) ?? NO_FLAGS);
          // Another version's value this one can't read: left as it is here.
          if (!parsed.success) continue;
          const flags = parsed.data;
          const plays = playsOf.get(game) ?? [];
          upsert.run({
            gameId,
            favorite: flags.favorite ? 1 : 0,
            hidden: flags.hidden ? 1 : 0,
            completed: flags.completed ? 1 : 0,
            userRating: flags.userRating,
            count: plays.reduce((sum, p) => sum + p.count, 0),
            seconds: plays.reduce((sum, p) => sum + p.seconds, 0),
            last: plays.reduce<string | null>((max, p) => latest(max, p.lastPlayedAt), null),
          });
          ids.push(gameId);
        }
      })();
      if (ids.length > 0) changed(ids);
    },
  };
}
