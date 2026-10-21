import { AppErrorException } from '@nextlevel/shared';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { launchHarness, PROFILE_ID, ROM_PATH } from './testing.ts';

let h: Awaited<ReturnType<typeof launchHarness>>;
beforeEach(async () => {
  h = await launchHarness();
});
afterEach(async () => {
  await h.cleanup();
});

const finished = () => h.events.filter((e) => e.event === 'launch.finished').map((e) => e.payload);
const waitFinished = () =>
  vi.waitFor(() => {
    expect(finished()).toHaveLength(1);
  });
const playState = () =>
  h.library.db.$client
    .prepare('select play_count, play_seconds from game_user_state where game_id = ?')
    .get(h.gameId);

async function errorOf(run: () => Promise<unknown>): Promise<AppErrorException['error']> {
  try {
    await run();
  } catch (error) {
    if (error instanceof AppErrorException) return error.error;
    throw error;
  }
  throw new Error('expected an AppErrorException');
}

describe('LaunchService.play (FR-EMU-6, US-C2)', () => {
  it('US-C2: spawns the resolved command, minimized while it runs, restored on exit', async () => {
    const { launchId } = await h.service.play(h.gameId);
    expect(h.spawn.calls).toEqual([
      {
        executable: 'E:\\emu\\retroarch.exe',
        args: ['-L', 'E:\\emu\\cores\\n64_libretro.dll', ROM_PATH],
        cwd: 'E:\\emu',
        env: expect.any(Object) as unknown,
      },
    ]);
    expect(h.window.calls).toEqual(['minimize']);
    expect(h.service.running()).toEqual({ gameId: h.gameId, launchId });
    expect(h.events[0]).toEqual({
      event: 'launch.started',
      payload: { launchId, gameId: h.gameId },
    });

    h.clock.advance(60_000);
    h.spawn.exit(0);
    await waitFinished();
    expect(finished()[0]).toEqual({
      launchId,
      gameId: h.gameId,
      exitCode: 0,
      durationMs: 60_000,
      counted: true,
    });
    expect(h.window.calls).toEqual(['minimize', 'restore']);
    expect(h.service.running()).toBeNull();
    expect(playState()).toEqual({ play_count: 1, play_seconds: 60 });
    expect(h.launches.page(0, 1).entries[0]).toMatchObject({ exitCode: 0, test: false });
  });

  it('FR-EMU-6: a second Play while a game runs → ALREADY_RUNNING, one process', async () => {
    await h.service.play(h.gameId);
    expect((await errorOf(() => h.service.play(h.gameId))).code).toBe('ALREADY_RUNNING');
    expect(h.spawn.calls).toHaveLength(1);
  });

  it('D5: exit ≠ 0 within 10 s is a failure with stderr, not a play', async () => {
    h.spawn.stderr = 'core failed to load';
    await h.service.play(h.gameId);
    h.clock.advance(3_000);
    h.spawn.exit(1);
    await waitFinished();
    expect(finished()[0]).toMatchObject({
      counted: false,
      exitCode: 1,
      error: {
        code: 'LAUNCH_FAILED',
        details: {
          exitCode: 1,
          stderrTail: 'core failed to load',
          fix: { section: 'emulators', id: PROFILE_ID },
        },
      },
    });
    expect(playState()).toBeUndefined();
    expect(h.launches.page(0, 1).entries[0]).toMatchObject({
      errorCode: 'LAUNCH_FAILED',
      stderrTail: 'core failed to load',
    });
  });

  it('D5: exit ≠ 0 after 10 s still counts as a play', async () => {
    await h.service.play(h.gameId);
    h.clock.advance(30_000);
    h.spawn.exit(1);
    await waitFinished();
    expect(finished()[0]).toMatchObject({ counted: true, exitCode: 1 });
    expect(finished()[0]).not.toHaveProperty('error');
  });

  it('US-C2: a process that can’t start fails Play, restores the window and logs it', async () => {
    h.spawn.failNext = true;
    expect((await errorOf(() => h.service.play(h.gameId))).code).toBe('LAUNCH_FAILED');
    expect(h.window.calls).toEqual(['minimize', 'restore']);
    expect(h.service.running()).toBeNull();
    expect(h.launches.page(0, 1).entries[0]).toMatchObject({ errorCode: 'LAUNCH_FAILED' });
    expect(h.launches.unfinished()).toEqual([]);
  });

  it('US-C2: a missing executable → EMULATOR_MISSING before anything starts', async () => {
    h.files.delete('E:\\emu\\retroarch.exe');
    const error = await errorOf(() => h.service.play(h.gameId));
    expect(error).toMatchObject({
      code: 'EMULATOR_MISSING',
      details: { path: 'E:\\emu\\retroarch.exe' },
    });
    expect(h.spawn.calls).toEqual([]);
    expect(h.window.calls).toEqual([]);
    expect(h.service.running()).toBeNull();
  });

  it('US-C2: a missing ROM → ROM_MISSING', async () => {
    h.files.delete(ROM_PATH);
    expect((await errorOf(() => h.service.play(h.gameId))).code).toBe('ROM_MISSING');
  });

  it('ADR-004: .bat and .cmd emulators are refused (no shell)', async () => {
    h.setEmulatorExe('E:\\emu\\run.bat');
    const error = await errorOf(() => h.service.play(h.gameId));
    expect(error).toMatchObject({ code: 'LAUNCH_FAILED', details: { reason: 'script' } });
    expect(h.spawn.calls).toEqual([]);
  });

  it('US-C2: a working folder that doesn’t exist → LAUNCH_FAILED naming it, nothing starts', async () => {
    h.files.delete('E:\\emu');
    const error = await errorOf(() => h.service.play(h.gameId));
    expect(error).toMatchObject({
      code: 'LAUNCH_FAILED',
      details: { path: 'E:\\emu', reason: 'cwdMissing', fix: { section: 'emulators' } },
    });
    expect(h.spawn.calls).toEqual([]);
    expect(h.window.calls).toEqual([]);
  });

  it('FR-EMU-4: the game override’s core and extra args are used', async () => {
    h.launches.setOverride(h.gameId, {
      profileId: null,
      core: 'other_libretro',
      extraArgs: ['-x'],
    });
    h.setProfileArgs(['-L', '{core}', '{extraArgs}', '{rom}']);
    await h.service.play(h.gameId);
    expect(h.spawn.calls[0]?.args).toEqual(['-L', 'other_libretro', '-x', ROM_PATH]);
  });

  it('FR-EMU-8: extract mode launches the extracted file and removes it after exit', async () => {
    h.setArchives('extract');
    h.extractor.files = { 'Racer.z64': 10 };
    await h.service.play(h.gameId);
    const launched = h.spawn.calls[0]?.args.at(-1) ?? '';
    expect(launched.endsWith('Racer.z64')).toBe(true);
    expect(existsSync(launched)).toBe(true);
    h.spawn.exit(0);
    await waitFinished();
    expect(existsSync(launched)).toBe(false);
  });

  it('cleans up extraction folders left by an earlier run', async () => {
    const stale = join(h.tempDir, 'nextlevel-launch', 'old');
    await mkdir(stale, { recursive: true });
    await writeFile(join(stale, 'x.iso'), 'x');
    await h.service.cleanupStaleExtractions();
    expect(existsSync(stale)).toBe(false);
  });
});

describe('LaunchService.test and preview (FR-EMU-5)', () => {
  it('FR-EMU-5: Test launch runs a draft profile and returns command, exit code and stderr', async () => {
    h.spawn.stderr = 'warning';
    const result = h.service.test({ ...h.draft(), gameId: h.gameId });
    await vi.waitFor(() => {
      expect(h.spawn.calls).toHaveLength(1);
    });
    h.clock.advance(1_500);
    h.spawn.exit(2);
    expect(await result).toEqual({
      executable: 'E:\\emu\\retroarch.exe',
      args: ['-L', 'E:\\emu\\cores\\n64_libretro.dll', ROM_PATH],
      cwd: 'E:\\emu',
      commandLine: `E:\\emu\\retroarch.exe -L E:\\emu\\cores\\n64_libretro.dll "${ROM_PATH}"`,
      exitCode: 2,
      stderrTail: 'warning',
      durationMs: 1_500,
    });
    expect(h.window.calls).toEqual([]);
    expect(playState()).toBeUndefined();
    expect(h.launches.page(0, 1).entries[0]).toMatchObject({ test: true, exitCode: 2 });
  });

  it('FR-EMU-5: Test launch reports a missing executable in the result', async () => {
    h.files.delete('E:\\emu\\retroarch.exe');
    const result = await h.service.test({ ...h.draft(), gameId: h.gameId });
    expect(result).toMatchObject({ exitCode: null, error: { code: 'EMULATOR_MISSING' } });
    expect(result.commandLine).toContain('retroarch.exe');
  });

  it('FR-EMU-5: Test launch reports a missing working folder in the result', async () => {
    h.files.delete('E:\\emu');
    const result = await h.service.test({ ...h.draft(), gameId: h.gameId });
    expect(result).toMatchObject({
      cwd: 'E:\\emu',
      exitCode: null,
      error: { code: 'LAUNCH_FAILED', details: { path: 'E:\\emu', reason: 'cwdMissing' } },
    });
    expect(h.spawn.calls).toEqual([]);
  });

  it('FR-EMU-5: preview without a game uses an example ROM path', () => {
    expect(h.service.preview(h.draft()).args.at(-1)).toMatch(
      /^E:\\roms\\Nintendo 64\\Example Game \(USA\)\.\w+$/,
    );
  });

  it('FR-EMU-5: preview with a game uses its path and override', () => {
    h.launches.setOverride(h.gameId, { profileId: null, core: null, extraArgs: ['--x'] });
    const draft = h.draft();
    draft.profile.args = ['{extraArgs}', '{rom}'];
    expect(h.service.preview({ ...draft, gameId: h.gameId }).args).toEqual(['--x', ROM_PATH]);
  });
});
