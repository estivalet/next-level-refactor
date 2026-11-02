import { AppErrorException } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { launchHarness } from './testing.ts';

// FR-EMU-9: Xenia Canary gets the file an Xbox 360 `.m3u` points to, not the `.m3u` itself.

const POINTER = '5th Grader.m3u';
const SYSTEM = 'E:\\roms\\Nintendo 64';
const TARGET = `${SYSTEM}\\content\\5th Grader\\58410900\\000D0000\\25B4882BF974`;

let h: Awaited<ReturnType<typeof launchHarness>>;
beforeEach(async () => {
  h = await launchHarness({ romFile: POINTER });
  h.setEmulatorExe('E:\\emu\\xenia\\xenia_canary.exe');
  h.setProfileArgs(['{rom}', '--fullscreen']);
  h.setPointerExtensions(['m3u', 'xbox360']);
  h.texts.set(h.romPath, '\\content\\5th Grader\\58410900\\000D0000\\25B4882BF974\r\n');
});
afterEach(async () => {
  await h.cleanup();
});

describe('LaunchService with pointer files (FR-EMU-9)', () => {
  it('FR-EMU-9: Play spawns the emulator with the file the .m3u points to', async () => {
    h.files.add(TARGET);
    await h.service.play(h.gameId);
    expect(h.spawn.calls[0]?.args).toEqual([TARGET, '--fullscreen']);
  });

  it('FR-EMU-9: without pointer extensions the .m3u itself is passed', async () => {
    h.setPointerExtensions([]);
    await h.service.play(h.gameId);
    expect(h.spawn.calls[0]?.args).toEqual([h.romPath, '--fullscreen']);
  });

  it('FR-EMU-9: a pointer to a missing file fails before spawning, with a Settings fix', async () => {
    const error = await h.service.play(h.gameId).then(
      () => null,
      (caught: unknown) => (caught instanceof AppErrorException ? caught.error : null),
    );
    expect(error).toMatchObject({
      code: 'LAUNCH_FAILED',
      details: { reason: 'pointerMissing', path: TARGET, fix: { section: 'emulators' } },
    });
    expect(h.spawn.calls).toHaveLength(0);
    expect(h.service.running()).toBeNull();
  });
});
