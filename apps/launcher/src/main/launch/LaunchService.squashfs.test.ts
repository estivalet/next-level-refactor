import { AppErrorException } from '@nextlevel/shared';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { launchHarness } from './testing.ts';

// FR-EMU-9: a `.wsquashfs` game is mounted, launched against the drive and always unmounted.

const IMAGE = 'Agent328OB.wsquashfs';
let h: Awaited<ReturnType<typeof launchHarness>>;
beforeEach(async () => {
  h = await launchHarness({ romFile: IMAGE });
  h.useHypseusSinge();
  h.mounts.contents = ['Agent328OB.singe', 'Agent328OB.txt', 'Agent328OB.zip'];
});
afterEach(async () => {
  await h.cleanup();
});

const finished = () => h.events.filter((e) => e.event === 'launch.finished').map((e) => e.payload);
const waitFinished = () =>
  vi.waitFor(() => {
    expect(finished()).toHaveLength(1);
  });

/** Runs a Test launch of `draft` and lets the emulator exit as soon as it started. */
async function runTest(draft: ReturnType<typeof h.draft>) {
  const running = h.service.test({ ...draft, gameId: h.gameId });
  await vi.waitFor(() => {
    expect(h.spawn.calls).toHaveLength(1);
  });
  h.spawn.exit(0);
  return running;
}

async function errorOf(run: () => Promise<unknown>): Promise<AppErrorException['error']> {
  try {
    await run();
  } catch (error) {
    if (error instanceof AppErrorException) return error.error;
    throw error;
  }
  throw new Error('expected an AppErrorException');
}

describe('LaunchService with squashfs images (FR-EMU-9)', () => {
  it('FR-EMU-9: Play mounts a .wsquashfs, renders the command against the drive, unmounts after exit', async () => {
    await h.service.play(h.gameId);
    expect(h.mounts.calls).toEqual([
      {
        tool: 'E:\\NextLevel\\tools\\mountsquashfs.exe',
        image: h.romPath,
        overlay: join(h.overlayRoot, 'nintendo-64', 'Agent328OB'),
      },
    ]);
    expect(h.spawn.calls[0]?.args).toEqual([
      'singe',
      'vldp',
      '-framefile',
      'Q:\\Agent328OB.txt',
      '-script',
      'Q:\\Agent328OB.singe',
      '-fullscreen',
    ]);
    expect(h.mounts.unmounted).toBe(0);
    h.clock.advance(60_000);
    h.spawn.exit(0);
    await waitFinished();
    expect(h.mounts.unmounted).toBe(1);
  });

  it('FR-EMU-9: spawn failure after mounting still unmounts', async () => {
    h.spawn.failNext = true;
    await errorOf(() => h.service.play(h.gameId));
    expect(h.mounts.calls).toHaveLength(1);
    expect(h.mounts.unmounted).toBe(1);
    expect(h.service.running()).toBeNull();
  });

  it('FR-EMU-9: exit code 1 within 10 s still unmounts and reports the failure', async () => {
    await h.service.play(h.gameId);
    h.clock.advance(1_000);
    h.spawn.exit(1);
    await waitFinished();
    expect(finished()[0]).toMatchObject({ counted: false, error: { code: 'LAUNCH_FAILED' } });
    expect(h.mounts.unmounted).toBe(1);
  });

  it('FR-EMU-9: a failing unmount after a spawn failure still frees the launcher', async () => {
    h.mounts.failUnmount = true;
    h.spawn.failNext = true;
    const error = await errorOf(() => h.service.play(h.gameId));
    expect(error.details).toMatchObject({ reason: 'ENOENT' });
    h.spawn.failNext = false;
    h.mounts.failUnmount = false;
    await h.service.play(h.gameId);
    expect(h.spawn.calls).toHaveLength(2);
  });

  it('FR-EMU-9: a library error when the game ends still unmounts', async () => {
    await h.service.play(h.gameId);
    vi.spyOn(h.launches, 'recordPlay').mockImplementation(() => {
      throw new Error('SQLITE_BUSY');
    });
    h.clock.advance(60_000);
    h.spawn.exit(0);
    await waitFinished();
    expect(h.mounts.unmounted).toBe(1);
  });

  it('FR-EMU-9: missing game files after mounting → entryMissing, unmounted, nothing spawned', async () => {
    h.mounts.contents = ['Agent328OB.txt'];
    const error = await errorOf(() => h.service.play(h.gameId));
    expect(error.details).toMatchObject({ reason: 'entryMissing' });
    expect(h.spawn.calls).toEqual([]);
    expect(h.mounts.unmounted).toBe(1);
  });

  it('FR-EMU-9: no mount tool → mountToolMissing with Fix in Settings, nothing spawned', async () => {
    h.mounts.tool = null;
    const error = await errorOf(() => h.service.play(h.gameId));
    expect(error).toMatchObject({
      code: 'LAUNCH_FAILED',
      details: { reason: 'mountToolMissing', fix: { section: 'emulators' } },
    });
    expect(h.spawn.calls).toEqual([]);
    expect(h.mounts.calls).toEqual([]);
  });

  it('FR-EMU-9: a failed mount gets Fix in Settings and frees the launcher for the next game', async () => {
    h.mounts.fail = true;
    const error = await errorOf(() => h.service.play(h.gameId));
    expect(error.details).toMatchObject({ reason: 'mountFailed', fix: { section: 'emulators' } });
    h.mounts.fail = false;
    await h.service.play(h.gameId);
    expect(h.spawn.calls).toHaveLength(1);
  });

  it('FR-EMU-9: the overlay folder is under the data folder, per system and image', async () => {
    await h.service.play(h.gameId);
    expect(h.mounts.calls[0]?.overlay.startsWith(h.overlayRoot)).toBe(true);
  });

  it('FR-EMU-9: a profile set to pass hands the image to the emulator unmounted', async () => {
    const draft = h.draft();
    draft.profile = { ...draft.profile, squashfs: 'pass', entries: [], args: ['{rom}'] };
    await runTest(draft);
    expect(h.mounts.calls).toEqual([]);
    expect(h.spawn.calls[0]?.args).toEqual([h.romPath]);
  });

  it('FR-EMU-9: a .hypseus folder ROM uses the folder as {gameDir}, no mount', async () => {
    await h.cleanup();
    h = await launchHarness({ romFile: 'maddog-hd.hypseus' });
    h.useHypseusSinge();
    h.dirs.add(h.romPath);
    h.files.add(`${h.romPath}\\maddog-hd.singe`);
    await h.service.play(h.gameId);
    expect(h.mounts.calls).toEqual([]);
    expect(h.spawn.calls[0]?.args).toEqual([
      'singe',
      'vldp',
      '-framefile',
      `${h.romPath}\\maddog-hd.txt`,
      '-script',
      `${h.romPath}\\maddog-hd.singe`,
      '-fullscreen',
    ]);
  });

  it('FR-EMU-9: a Daphne .commands file goes before the game extra args', async () => {
    const draft = h.draft();
    draft.profile.entries = [];
    draft.profile.argsFile = '{gameDir}\\{romName}.commands';
    draft.profile.args = ['{romName}', '{extraArgs}'];
    h.texts.set('Q:\\Agent328OB.commands', '-sound_buffer 2048');
    h.mounts.contents.push('Agent328OB.commands');
    await runTest(draft);
    expect(h.spawn.calls[0]?.args).toEqual(['Agent328OB', '-sound_buffer', '2048']);
  });

  it('FR-EMU-5: Test launch mounts and unmounts like Play', async () => {
    const result = await runTest(h.draft());
    expect(result.error).toBeUndefined();
    expect(h.mounts.calls).toHaveLength(1);
    expect(h.mounts.unmounted).toBe(1);
  });

  it('FR-EMU-5: preview of a mount profile shows X: and does not mount', () => {
    const shown = h.service.preview({ ...h.draft(), gameId: h.gameId });
    expect(shown.args).toEqual([
      'singe',
      'vldp',
      '-framefile',
      'X:\\Agent328OB.txt',
      '-script',
      'X:\\Agent328OB.singe',
      '-fullscreen',
    ]);
    expect(h.mounts.calls).toEqual([]);
  });
});
