import {
  EMPTY_LAUNCH_OVERRIDE,
  type LaunchLogEntry,
  type LaunchLogPage,
  type LaunchOverride,
} from '@nextlevel/shared';
import { notFound } from './GameRepository.ts';
import type { LibraryDb } from './openLibrary.ts';

/** Launch log rows kept (data model §4). */
export const LAUNCH_LOG_LIMIT = 1000;

export type LaunchStart = Omit<
  LaunchLogEntry,
  'id' | 'endedAt' | 'exitCode' | 'errorCode' | 'stderrTail'
>;
/** What a launch needs to know about a game, read from the library (never from the renderer). */
export interface LaunchGame {
  gameId: number;
  systemId: string;
  relPath: string;
  locationId: string | null;
  title: string;
  missing: boolean;
}

export type LaunchEnd = Pick<LaunchLogEntry, 'endedAt' | 'exitCode' | 'errorCode' | 'stderrTail'>;

interface LogRow {
  id: number;
  gameId: number | null;
  gameTitle: string;
  profileId: string;
  profileName: string;
  argv: string;
  cwd: string;
  test: number;
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
  errorCode: string | null;
  stderrTail: string | null;
}

const LOG_COLUMNS = `id, game_id as gameId, game_title as gameTitle, profile_id as profileId,
  profile_name as profileName, argv, cwd, test, started_at as startedAt, ended_at as endedAt,
  exit_code as exitCode, error_code as errorCode, stderr_tail as stderrTail`;

/** Per-game launch overrides, the launch log and play stats (FR-EMU-4, FR-EMU-10, US-C2). */
export class LaunchRepository {
  constructor(private readonly db: LibraryDb) {}

  private get client() {
    return this.db.$client;
  }

  gameInfo(gameId: number): LaunchGame {
    const row = this.client
      .prepare(
        `select g.id as gameId, g.system_id as systemId, g.rel_path as relPath,
         g.location_id as locationId, m.title as title, g.missing as missing
         from games g join game_metadata m on m.game_id = g.id where g.id = ?`,
      )
      .get(gameId) as (Omit<LaunchGame, 'missing'> & { missing: number }) | undefined;
    if (!row) throw notFound({ gameId });
    return { ...row, missing: row.missing === 1 };
  }

  getOverride(gameId: number): LaunchOverride {
    const row = this.client
      .prepare(
        'select profile_id as profileId, core, extra_args as extraArgs from game_launch_override where game_id = ?',
      )
      .get(gameId) as
      { profileId: string | null; core: string | null; extraArgs: string } | undefined;
    if (!row) return EMPTY_LAUNCH_OVERRIDE;
    return { ...row, extraArgs: JSON.parse(row.extraArgs) as string[] };
  }

  /** Saves a game's override; an empty one removes the row. */
  setOverride(gameId: number, override: LaunchOverride): void {
    const empty = !override.profileId && !override.core && override.extraArgs.length === 0;
    if (empty) {
      this.client.prepare('delete from game_launch_override where game_id = ?').run(gameId);
      return;
    }
    this.client
      .prepare(
        `insert into game_launch_override (game_id, profile_id, core, extra_args) values (?, ?, ?, ?)
         on conflict (game_id) do update set profile_id = excluded.profile_id, core = excluded.core,
         extra_args = excluded.extra_args`,
      )
      .run(gameId, override.profileId, override.core, JSON.stringify(override.extraArgs));
  }

  /** Logs a launch as it starts and prunes the log to the newest rows; returns the row id. */
  start(entry: LaunchStart): number {
    return this.client.transaction(() => {
      const { lastInsertRowid } = this.client
        .prepare(
          `insert into launch_log (game_id, game_title, profile_id, profile_name, argv, cwd, test, started_at)
           values (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          entry.gameId,
          entry.gameTitle,
          entry.profileId,
          entry.profileName,
          JSON.stringify(entry.argv),
          entry.cwd,
          entry.test ? 1 : 0,
          entry.startedAt,
        );
      this.client
        .prepare(
          'delete from launch_log where id not in (select id from launch_log order by started_at desc, id desc limit ?)',
        )
        .run(LAUNCH_LOG_LIMIT);
      return Number(lastInsertRowid);
    })();
  }

  finish(id: number, end: LaunchEnd): void {
    this.client
      .prepare(
        'update launch_log set ended_at = ?, exit_code = ?, error_code = ?, stderr_tail = ? where id = ?',
      )
      .run(end.endedAt, end.exitCode, end.errorCode, end.stderrTail, id);
  }

  /** Newest first. */
  page(offset: number, limit: number): LaunchLogPage {
    const total = this.client.prepare('select count(*) from launch_log').pluck().get() as number;
    const rows = this.client
      .prepare(
        `select ${LOG_COLUMNS} from launch_log order by started_at desc, id desc limit ? offset ?`,
      )
      .all(limit, offset) as LogRow[];
    return {
      total,
      offset,
      entries: rows.map((row) => ({
        ...row,
        argv: JSON.parse(row.argv) as string[],
        test: row.test === 1,
      })),
    };
  }

  /** Counts a play: play count + 1, play time, last played (US-C2). */
  recordPlay(gameId: number, seconds: number, at: Date): void {
    this.client
      .prepare(
        `insert into game_user_state (game_id, play_count, play_seconds, last_played_at) values (?, 1, ?, ?)
         on conflict (game_id) do update set play_count = play_count + 1,
         play_seconds = play_seconds + excluded.play_seconds, last_played_at = excluded.last_played_at`,
      )
      .run(gameId, Math.max(0, Math.round(seconds)), at.toISOString());
  }

  /** Launches with no end, e.g. the launcher quit while the emulator ran. */
  unfinished(): number[] {
    return this.client
      .prepare('select id from launch_log where ended_at is null order by id')
      .pluck()
      .all() as number[];
  }
}
