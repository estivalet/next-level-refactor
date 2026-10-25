import type { BatchField, BatchRules, BatchScope } from '@nextlevel/shared';
import type { LibraryDb } from '../../library/openLibrary.ts';

/** `game_metadata` column per batch field; keys come from the shared schema, never raw input. */
const FIELD_COLUMNS: Record<BatchField, string> = {
  description: 'description',
  year: 'year',
  developer: 'developer',
  publisher: 'publisher',
  genre: 'genre',
  players: 'players',
  rating: 'rating',
};

export interface NextGameJob {
  scope: BatchScope;
  rules: BatchRules;
  /** The last game handled, or null at the start. */
  cursorGameId: number | null;
}

/** The FROM/WHERE of a job's games; `@cursor` is only bound by nextGame. */
function where(scope: BatchScope, rules: BatchRules) {
  const params: Record<string, unknown> = {};
  const parts: string[] = [];
  if ('systemIds' in scope) {
    // `+` keeps SQLite off the system index: walking ids from the cursor is what stays fast.
    parts.push('+g.system_id in (select value from json_each(@systems))');
    params.systems = JSON.stringify(scope.systemIds);
  } else {
    parts.push('g.id in (select value from json_each(@ids))');
    params.ids = JSON.stringify(scope.gameIds);
  }
  if (rules.onlyMissing) {
    const lacks: string[] = [];
    if (rules.kinds.length > 0) {
      lacks.push(`(select count(*) from game_media x where x.game_id = g.id
        and x.kind in (select value from json_each(@kinds))) < @kindCount`);
      params.kinds = JSON.stringify([...new Set(rules.kinds)]);
      params.kindCount = new Set(rules.kinds).size;
    }
    // A field the user edited is never written (D19), so an empty locked field is no gap.
    for (const field of new Set(rules.fields)) {
      const column = FIELD_COLUMNS[field];
      lacks.push(`((m.${column} is null or m.${column} = '')
        and not exists (select 1 from json_each(m.locked_fields) l where l.value = '${field}'))`);
    }
    parts.push(lacks.length > 0 ? `(${lacks.join(' or ')})` : '0');
  }
  return {
    sql: `from games g join game_metadata m on m.game_id = g.id where ${parts.join(' and ')}`,
    params,
  };
}

/**
 * The next game of a batch (FR-SCR-2): games in scope after the cursor, by id; with
 * `onlyMissing`, games that already have every chosen kind and a value in every chosen field are
 * skipped. Missing games stay in (they are searched by title).
 */
export function nextGame(db: LibraryDb, job: NextGameJob): { gameId: number } | null {
  const { sql, params } = where(job.scope, job.rules);
  const id = db.$client
    .prepare(`select g.id ${sql} and g.id > @cursor order by g.id limit 1`)
    .pluck()
    .get({ ...params, cursor: job.cursorGameId ?? 0 }) as number | undefined;
  return id === undefined ? null : { gameId: id };
}

/** How many games a new job would handle (its `total`). */
export function countGames(db: LibraryDb, scope: BatchScope, rules: BatchRules): number {
  const { sql, params } = where(scope, rules);
  return db.$client.prepare(`select count(*) ${sql}`).pluck().get(params) as number;
}
