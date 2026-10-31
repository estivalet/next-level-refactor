import {
  ok,
  type GameDetails,
  type GameListQuery,
  type GameRow,
  type ScanStatus,
  type SystemDefinition,
  type SystemSummary,
} from '@nextlevel/shared';
import type { FakeResponses } from '../../test-utils.tsx';

export const N64: SystemDefinition = {
  id: 'nintendo-64',
  name: 'Nintendo 64',
  manufacturer: 'Nintendo',
  kind: 'console',
  extensions: ['z64'],
  defaultFolderName: 'Nintendo 64',
  scraper: {},
  presetProfiles: [],
  aliases: [],
};

export const SNES: SystemDefinition = { ...N64, id: 'snes', name: 'Super Nintendo' };

export const IDLE: ScanStatus = { running: false, progress: null, last: null };

export function gameRow(id: number, title: string, overrides: Partial<GameRow> = {}): GameRow {
  return {
    id,
    systemId: 'nintendo-64',
    title,
    year: null,
    genre: null,
    players: null,
    favorite: false,
    hidden: false,
    completed: false,
    userRating: null,
    missing: false,
    expectedPath: null,
    ...overrides,
  };
}

export function gameDetails(row: GameRow, overrides: Partial<GameDetails> = {}): GameDetails {
  return {
    ...row,
    relPath: `${row.title}.z64`,
    discGroup: null,
    missingSince: row.missing ? '2026-10-20T12:00:00.000Z' : null,
    addedAt: '2026-10-21T12:00:00.000Z',
    developer: null,
    publisher: null,
    description: null,
    region: null,
    rating: null,
    filters: [],
    lockedFields: [],
    playCount: 0,
    lastPlayedAt: null,
    collectionIds: [],
    scrape: null,
    media: {},
    ...overrides,
  };
}

/**
 * Fake library responses: `games` answer `library.games.list` filtered like main does for the
 * tab (hidden left out of All), and `library.games.get` from the same rows.
 */
export function libraryResponses(
  games: GameRow[],
  systems: SystemSummary[] = [
    { id: 'nintendo-64', enabled: true, games: games.length, missing: 0, review: 0 },
  ],
): FakeResponses {
  const inTab = (game: GameRow, tab: GameListQuery['tab']) => {
    if (tab === 'hidden') return game.hidden;
    if (game.hidden) return false;
    if (tab === 'favorites') return game.favorite;
    if (tab === 'missing') return game.missing;
    return true;
  };
  return {
    'systems.catalog': () => ok([N64, SNES]),
    'systems.list': () => ok(systems),
    'collections.list': () => ok([]),
    'scan.status': () => ok(IDLE),
    'library.games.list': (query) => {
      const rows = games.filter(
        (game) =>
          inTab(game, query.tab) &&
          (query.scope.kind !== 'system' || game.systemId === query.scope.systemId),
      );
      return ok({
        total: rows.length,
        offset: query.offset,
        games: rows.slice(query.offset, query.offset + query.limit),
      });
    },
    'library.games.get': ({ gameId }) => {
      const row = games.find((game) => game.id === gameId) ?? gameRow(gameId, 'Unknown');
      return ok(gameDetails(row));
    },
  };
}
