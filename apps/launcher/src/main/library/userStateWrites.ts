import type { GameFlags, PlayabilityChange } from '@nextlevel/shared';
import type Database from 'better-sqlite3';
import { notFound } from './libraryErrors.ts';

const FLAG_COLUMNS = {
  favorite: 'favorite',
  hidden: 'hidden',
  completed: 'completed',
  deleteLater: 'delete_later',
  userRating: 'user_rating',
} as const;

const ENSURE = 'insert into game_user_state (game_id) values (?) on conflict do nothing';

function assertKnown(client: Database.Database, ids: readonly number[]): void {
  const known = client
    .prepare('select count(*) from games where id in (select value from json_each(?))')
    .pluck()
    .get(JSON.stringify(ids)) as number;
  if (known !== ids.length) throw notFound({ gameIds: ids });
}

/**
 * Sets the playability mark of several games, dated `now`; without a note each keeps its own.
 * `mark: null` clears mark, note and date (FR-LIB-13). One unknown id writes nothing.
 */
export function setGamesPlayability(
  client: Database.Database,
  gameIds: readonly number[],
  change: PlayabilityChange,
  now: Date,
): void {
  const ids = [...new Set(gameIds)];
  client.transaction(() => {
    assertKnown(client, ids);
    const ensure = client.prepare(ENSURE);
    const update = client.prepare(
      change.mark === null
        ? `update game_user_state set playability = null, playability_note = '',
             playability_at = null where game_id = @gameId`
        : `update game_user_state set playability = @mark, playability_at = @at
             ${change.note === undefined ? '' : ', playability_note = @note'}
           where game_id = @gameId`,
    );
    for (const gameId of ids) {
      ensure.run(gameId);
      update.run(
        change.mark === null
          ? { gameId }
          : {
              gameId,
              mark: change.mark,
              at: now.toISOString(),
              ...(change.note === undefined ? {} : { note: change.note }),
            },
      );
    }
  })();
}

/** Favorite, hidden, completed, Delete later and the user's rating for several games (FR-LIB-7, FR-LIB-19). */
export function setGamesFlags(
  client: Database.Database,
  gameIds: readonly number[],
  flags: GameFlags,
): void {
  const ids = [...new Set(gameIds)];
  const sets = Object.entries(FLAG_COLUMNS)
    .filter(([flag]) => flags[flag as keyof GameFlags] !== undefined)
    .map(([flag, column]) => `${column} = @${flag}`);
  const params = {
    favorite: flags.favorite === undefined ? undefined : Number(flags.favorite),
    hidden: flags.hidden === undefined ? undefined : Number(flags.hidden),
    completed: flags.completed === undefined ? undefined : Number(flags.completed),
    deleteLater: flags.deleteLater === undefined ? undefined : Number(flags.deleteLater),
    userRating: flags.userRating,
  };
  client.transaction(() => {
    assertKnown(client, ids);
    const ensure = client.prepare(ENSURE);
    const update = client.prepare(
      `update game_user_state set ${sets.join(', ')} where game_id = @gameId`,
    );
    for (const gameId of ids) {
      ensure.run(gameId);
      update.run(
        Object.fromEntries(
          Object.entries({ ...params, gameId }).filter(([, value]) => value !== undefined),
        ),
      );
    }
  })();
}
