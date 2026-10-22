import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LaunchRepository, type LaunchStart } from './LaunchRepository.ts';
import { seedGames, tempLibrary } from './testing.ts';

const PROFILE = '01900000-0000-7000-8000-000000000002';

let library: Awaited<ReturnType<typeof tempLibrary>>;
let launches: LaunchRepository;
let gameId: number;
beforeEach(async () => {
  library = await tempLibrary();
  launches = new LaunchRepository(library.db);
  [gameId = 0] = seedGames(library.db, 'nintendo-64', ['Racer']);
});
afterEach(async () => {
  await library.cleanup();
});

const start = (overrides: Partial<LaunchStart> = {}): LaunchStart => ({
  gameId,
  gameTitle: 'Racer',
  profileId: PROFILE,
  profileName: 'RetroArch – N64',
  argv: ['E:\\emu\\retroarch.exe', 'E:\\roms\\Racer.zip'],
  cwd: 'E:\\emu',
  test: false,
  startedAt: '2026-10-21T12:00:00.000Z',
  ...overrides,
});

describe('LaunchRepository', () => {
  it('FR-EMU-4: a game without an override gets the empty override', () => {
    expect(launches.getOverride(gameId)).toEqual({ profileId: null, core: null, extraArgs: [] });
  });

  it('FR-EMU-4: overrides round-trip, and an empty one deletes the row', () => {
    const override = { profileId: PROFILE, core: 'x_libretro', extraArgs: ['--a', 'b c'] };
    launches.setOverride(gameId, override);
    expect(launches.getOverride(gameId)).toEqual(override);
    launches.setOverride(gameId, { profileId: null, core: null, extraArgs: [] });
    const rows = library.db.$client
      .prepare('select count(*) from game_launch_override')
      .pluck()
      .get();
    expect(rows).toBe(0);
  });

  it('FR-EMU-10: a launch is logged when it starts and completed when it ends', () => {
    const id = launches.start(start());
    expect(launches.page(0, 10).entries[0]).toMatchObject({ id, endedAt: null, exitCode: null });
    launches.finish(id, {
      endedAt: '2026-10-21T12:01:00.000Z',
      exitCode: 3,
      errorCode: 'LAUNCH_FAILED',
      stderrTail: 'boom',
    });
    expect(launches.page(0, 10)).toEqual({
      total: 1,
      offset: 0,
      entries: [
        {
          ...start(),
          id,
          endedAt: '2026-10-21T12:01:00.000Z',
          exitCode: 3,
          errorCode: 'LAUNCH_FAILED',
          stderrTail: 'boom',
        },
      ],
    });
  });

  it('FR-EMU-10: the log keeps the newest 1,000 launches, newest first', () => {
    for (let i = 0; i < 1001; i += 1) {
      launches.start(start({ startedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString() }));
    }
    const page = launches.page(0, 2);
    expect(page.total).toBe(1000);
    expect(page.entries.map((e) => e.startedAt)).toEqual([
      '2026-01-01T00:16:40.000Z',
      '2026-01-01T00:16:39.000Z',
    ]);
    expect(launches.page(999, 5).entries[0]?.startedAt).toBe('2026-01-01T00:00:01.000Z');
  });

  it('FR-EMU-10: log rows outlive their game', () => {
    launches.start(start());
    library.db.$client.prepare('delete from games where id = ?').run(gameId);
    expect(launches.page(0, 1).entries[0]).toMatchObject({ gameId: null, gameTitle: 'Racer' });
  });

  it('US-C2: recording a play counts it and adds the time', () => {
    launches.recordPlay(gameId, 60, new Date(Date.UTC(2026, 9, 21, 13)));
    launches.recordPlay(gameId, 30, new Date(Date.UTC(2026, 9, 21, 14)));
    const state = library.db.$client
      .prepare(
        'select play_count, play_seconds, last_played_at from game_user_state where game_id = ?',
      )
      .get(gameId);
    expect(state).toEqual({
      play_count: 2,
      play_seconds: 90,
      last_played_at: '2026-10-21T14:00:00.000Z',
    });
  });

  it('lists launches the launcher never saw end', () => {
    const open = launches.start(start());
    const done = launches.start(start());
    launches.finish(done, { endedAt: 'x', exitCode: 0, errorCode: null, stderrTail: null });
    expect(launches.unfinished()).toEqual([open]);
  });

  it('US-C2: gameInfo has what a launch needs, and unknown ids are NOT_FOUND', () => {
    expect(launches.gameInfo(gameId)).toEqual({
      gameId,
      systemId: 'nintendo-64',
      relPath: 'Racer.zip',
      locationId: 'loc-1',
      title: 'Racer',
      missing: false,
    });
    expect(() => launches.gameInfo(9999)).toThrow(/NOT_FOUND/);
  });
});
