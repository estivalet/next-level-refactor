import { AppErrorException, type AppError } from '@nextlevel/shared';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibraryRepository } from './LibraryRepository.ts';
import { openLibrary, type LibraryDb } from './openLibrary.ts';

/** A temp folder; cleanup retries because Windows can hold SQLite files briefly. */
export async function tempDir(prefix = 'nextlevel-library-') {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  return {
    dir,
    cleanup: () => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }),
  };
}

/** A fresh `library.db` in a temp folder, with its repository. */
export async function tempLibrary() {
  const temp = await tempDir();
  const db = openLibrary(join(temp.dir, 'library.db'), {
    backupsDir: join(temp.dir, 'backups'),
    clock: () => new Date(Date.UTC(2026, 9, 21, 12, 0, 0)),
  });
  return {
    dir: temp.dir,
    db,
    repo: new LibraryRepository(db),
    cleanup: async () => {
      db.$client.close();
      await temp.cleanup();
    },
  };
}

/** A game for `seedGames`: a title, or a title with the fields a test cares about. */
export interface SeedGame {
  title: string;
  relPath?: string;
  locationId?: string | null;
  year?: number;
  genre?: string;
  addedAt?: string;
  missing?: boolean;
  favorite?: boolean;
  hidden?: boolean;
  userRating?: number;
  players?: string;
  playCount?: number;
  lastPlayedAt?: string;
  filters?: string[];
}

/** Inserts games with metadata (and user state when given) in one transaction; returns ids. */
export function seedGames(db: LibraryDb, systemId: string, games: Array<string | SeedGame>) {
  const client = db.$client;
  const insertGame = client.prepare(
    `insert into games (system_id, rel_path, location_id, size, mtime, missing, missing_since, added_at)
     values (?, ?, ?, 1, 1, ?, ?, ?)`,
  );
  const insertMetadata = client.prepare(
    `insert into game_metadata (game_id, title, sort_title, year, genre, players, updated_at)
     values (?, ?, ?, ?, ?, ?, '2026-10-21T12:00:00.000Z')`,
  );
  const insertState = client.prepare(
    `insert into game_user_state (game_id, favorite, hidden, user_rating, play_count, last_played_at)
     values (?, ?, ?, ?, ?, ?)`,
  );
  const insertFilter = client.prepare('insert into game_filters (game_id, filter) values (?, ?)');
  return client.transaction(() =>
    games.map((entry) => {
      const game = typeof entry === 'string' ? { title: entry } : entry;
      const { lastInsertRowid } = insertGame.run(
        systemId,
        game.relPath ?? `${game.title}.zip`,
        game.locationId === undefined ? 'loc-1' : game.locationId,
        game.missing ? 1 : 0,
        game.missing ? '2026-10-20T12:00:00.000Z' : null,
        game.addedAt ?? '2026-10-21T12:00:00.000Z',
      );
      const id = Number(lastInsertRowid);
      insertMetadata.run(
        id,
        game.title,
        game.title.toLowerCase(),
        game.year ?? null,
        game.genre ?? null,
        game.players ?? null,
      );
      if (game.favorite || game.hidden || game.userRating || game.playCount || game.lastPlayedAt) {
        insertState.run(
          id,
          game.favorite ? 1 : 0,
          game.hidden ? 1 : 0,
          game.userRating ?? null,
          game.playCount ?? 0,
          game.lastPlayedAt ?? null,
        );
      }
      for (const filter of game.filters ?? []) insertFilter.run(id, filter);
      return id;
    }),
  )();
}

const WORDS = [
  'super',
  'mega',
  'zelda',
  'quest',
  'racer',
  'star',
  'dragon',
  'world',
  'island',
  'force',
];

/** `count` games titled from a fixed word list ("Super Mega 17"), for size and speed tests. */
export function seedManyGames(db: LibraryDb, systemId: string, count: number) {
  const titles: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const first = WORDS[i % WORDS.length] ?? '';
    const second = WORDS[Math.floor(i / WORDS.length) % WORDS.length] ?? '';
    titles.push(`${first[0]?.toUpperCase() ?? ''}${first.slice(1)} ${second} ${String(i)}`);
  }
  return seedGames(db, systemId, titles);
}

/** The AppError a call throws; fails the test when it throws anything else or nothing. */
export function appErrorOf(run: () => unknown): AppError {
  try {
    run();
  } catch (error) {
    if (error instanceof AppErrorException) return error.error;
    throw error;
  }
  throw new Error('expected an AppErrorException');
}

/**
 * A timing budget for performance tests: the NFR value on a developer machine, ×3 on CI, whose
 * shared runners are several times slower (test strategy: targets are met on the reference PC).
 */
export function perfBudget(ms: number): number {
  return process.env['CI'] ? ms * 3 : ms;
}
