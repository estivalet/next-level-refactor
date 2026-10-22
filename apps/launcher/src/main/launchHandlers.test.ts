import { emulatorPresets } from '@nextlevel/system-catalog';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createIpcRouter } from './ipc/router.ts';
import { withUnimplemented } from './ipc/withUnimplemented.ts';
import { launchHarness } from './launch/testing.ts';
import { createLaunchHandlers } from './launchHandlers.ts';
import { tempDir } from './library/testing.ts';

let h: Awaited<ReturnType<typeof launchHarness>>;
let picked: string[];
beforeEach(async () => {
  h = await launchHarness();
  picked = [];
});
afterEach(async () => {
  await h.cleanup();
});

function router(available = true) {
  const handlers = createLaunchHandlers({
    launch: () => {
      if (!available) throw new Error('unavailable');
      return { service: h.service, launches: h.launches };
    },
    emit: (event, payload) => {
      h.events.push({ event, payload });
    },
    presets: emulatorPresets,
    pickFile: (title) => {
      picked.push(title ?? '');
      return Promise.resolve('C:\\Emu\\Dolphin.exe');
    },
  });
  return createIpcRouter(withUnimplemented(handlers), { error: () => undefined });
}

describe('launch handlers (FR-EMU-5)', () => {
  it('FR-EMU-5: preview renders a draft profile', async () => {
    expect(await router().handle('launch.preview', h.draft())).toMatchObject({
      ok: true,
      value: { executable: 'E:\\emu\\retroarch.exe' },
    });
  });

  it('US-D1: a draft with an unknown token is rejected before anything runs', async () => {
    const draft = h.draft();
    draft.profile.args = ['{romm}'];
    expect(await router().handle('launch.test', { ...draft, gameId: h.gameId })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(h.spawn.calls).toEqual([]);
  });

  it('FR-EMU-5: a draft whose profile names another emulator is rejected', async () => {
    const draft = h.draft();
    draft.profile.emulatorId = '01900000-0000-7000-8000-0000000000ff';
    expect(await router().handle('launch.preview', draft)).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
  });

  it('extra keys are rejected', async () => {
    expect(await router().handle('launch.game', { gameId: h.gameId, x: 1 })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
  });

  it('US-C2: launch.game plays and launch.running reports it', async () => {
    const r = router();
    const played = await r.handle('launch.game', { gameId: h.gameId });
    expect(played).toMatchObject({ ok: true, value: { launchId: expect.any(Number) as unknown } });
    expect(await r.handle('launch.running', undefined)).toMatchObject({
      ok: true,
      value: { gameId: h.gameId },
    });
  });

  it('FR-EMU-4: per-game launch options round-trip and announce the change', async () => {
    const r = router();
    const override = { profileId: null, core: 'x_libretro', extraArgs: ['--a'] };
    expect(
      await r.handle('library.games.setLaunchOverride', { gameId: h.gameId, override }),
    ).toEqual({ ok: true, value: override });
    expect(await r.handle('library.games.launchOverride', { gameId: h.gameId })).toEqual({
      ok: true,
      value: override,
    });
    expect(h.events).toContainEqual({
      event: 'library.changed',
      payload: { systems: ['nintendo-64'], gameIds: [h.gameId] },
    });
  });

  it('FR-EMU-10: launch.log pages the log', async () => {
    h.launches.start({
      gameId: h.gameId,
      gameTitle: 'Racer',
      profileId: 'p',
      profileName: 'P',
      argv: ['x.exe'],
      cwd: 'C:\\',
      test: true,
      startedAt: '2026-10-21T12:00:00.000Z',
    });
    expect(await router().handle('launch.log', { offset: 0, limit: 10 })).toMatchObject({
      ok: true,
      value: { total: 1, entries: [{ gameTitle: 'Racer', test: true }] },
    });
    expect(await router().handle('launch.log', { offset: 0, limit: 201 })).toMatchObject({
      ok: false,
    });
  });

  it('launch channels fail when the library is unavailable', async () => {
    expect(await router(false).handle('launch.game', { gameId: 1 })).toMatchObject({ ok: false });
  });

  it('FR-EMU-7: presets and the executable picker', async () => {
    const r = router();
    const presets = await r.handle('emulators.presets', undefined);
    expect(presets.ok && (presets.value as unknown[]).length).toBeGreaterThan(5);
    expect(await r.handle('app.pickFile', { kind: 'executable', title: 'Pick' })).toEqual({
      ok: true,
      value: 'C:\\Emu\\Dolphin.exe',
    });
    expect(picked).toEqual(['Pick']);
  });
});

describe('emulators.detect (D6)', () => {
  let temp: Awaited<ReturnType<typeof tempDir>>;
  beforeEach(async () => {
    temp = await tempDir('nextlevel-detect-');
  });
  afterEach(async () => {
    await temp.cleanup();
  });

  async function touch(...parts: string[]) {
    await mkdir(join(temp.dir, ...parts.slice(0, -1)), { recursive: true });
    await writeFile(join(temp.dir, ...parts), '');
  }

  it('D6: finds preset executables up to two folders deep, ignoring case', async () => {
    await touch('retroarch', 'RetroArch.exe');
    await touch('consoles', 'gc', 'Dolphin.exe');
    await touch('a', 'b', 'c', 'pcsx2-qt.exe');
    await touch('notes.exe');
    expect(await router().handle('emulators.detect', { folder: temp.dir })).toEqual({
      ok: true,
      value: [
        { presetId: 'dolphin', executable: join(temp.dir, 'consoles', 'gc', 'Dolphin.exe') },
        { presetId: 'retroarch', executable: join(temp.dir, 'retroarch', 'RetroArch.exe') },
      ],
    });
  });

  it('D6: a folder that doesn’t exist finds nothing', async () => {
    expect(await router().handle('emulators.detect', { folder: join(temp.dir, 'nope') })).toEqual({
      ok: true,
      value: [],
    });
  });
});
