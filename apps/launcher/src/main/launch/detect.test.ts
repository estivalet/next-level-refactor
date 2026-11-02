import type { EmulatorPreset } from '@nextlevel/shared';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { detectEmulators } from './detect.ts';

let temp: Awaited<ReturnType<typeof tempDir>>;
beforeEach(async () => {
  temp = await tempDir('nextlevel-detect-');
});
afterEach(async () => {
  await temp.cleanup();
});

const preset = (id: string, executableNames: string[], windowsTool?: boolean): EmulatorPreset => ({
  id,
  name: id,
  executableNames,
  homepage: 'https://example.com/',
  ...(windowsTool ? { windowsTool } : {}),
  profiles: [{ id: `${id}:default`, name: id, systems: ['x'], args: ['{rom}'], archives: 'pass' }],
});

describe('emulator detection (FR-EMU-7)', () => {
  it('FR-EMU-7: finds preset executables up to two folders deep', async () => {
    await mkdir(join(temp.dir, 'emulators', 'hypseus_singe'), { recursive: true });
    await writeFile(join(temp.dir, 'emulators', 'hypseus_singe', 'hypseus.exe'), '');
    const found = await detectEmulators(temp.dir, [preset('hypseus', ['hypseus.exe'])], 'Z:\\none');
    expect(found).toEqual([
      {
        presetId: 'hypseus',
        executable: join(temp.dir, 'emulators', 'hypseus_singe', 'hypseus.exe'),
      },
    ]);
  });

  it('FR-EMU-7: detection finds cmd.exe for the Script preset in System32', async () => {
    const windows = join(temp.dir, 'Windows');
    await mkdir(join(windows, 'System32'), { recursive: true });
    await writeFile(join(windows, 'System32', 'cmd.exe'), '');
    const empty = join(temp.dir, 'emulators');
    await mkdir(empty);
    const found = await detectEmulators(empty, [preset('script', ['cmd.exe'], true)], windows);
    expect(found).toEqual([
      { presetId: 'script', executable: join(windows, 'System32', 'cmd.exe') },
    ]);
  });

  it('FR-EMU-7: a Windows tool that is not there is not offered', async () => {
    const found = await detectEmulators(
      temp.dir,
      [preset('script', ['cmd.exe'], true)],
      'Z:\\none',
    );
    expect(found).toEqual([]);
  });
});
