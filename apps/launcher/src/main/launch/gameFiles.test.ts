import type { AppErrorException, EntryRule, TokenContext } from '@nextlevel/shared';
import { existsSync } from 'node:fs';
import { emulatorPresets } from '@nextlevel/system-catalog';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { resolveGameFiles } from './gameFiles.ts';

let temp: Awaited<ReturnType<typeof tempDir>>;
beforeEach(async () => {
  temp = await tempDir('nextlevel-gamefiles-');
});
afterEach(async () => {
  await temp.cleanup();
});

/** The Hypseus Singe rules of the preset (plan Task 6). */
const singeRules: EntryRule[] = [
  { file: '{gameDir}\\{romName}.singe', args: ['-script', '{entry}'] },
  { file: '{gameDir}\\{romName}.zip', args: ['-zlua', '{entry}'] },
  { file: '{gameDir}\\*.zip', args: ['-zlua', '{entry}', '-usealt', '{romName}'] },
];

async function files(...names: string[]) {
  for (const name of names) await writeFile(join(temp.dir, name), 'x');
}

function ctx(romName: string): TokenContext {
  return {
    rom: join(temp.dir, `${romName}.wsquashfs`),
    romDir: temp.dir,
    romName,
    romFile: `${romName}.wsquashfs`,
    romExt: 'wsquashfs',
    systemId: 'singe',
    systemDir: temp.dir,
    emulatorDir: 'E:\\emu\\hypseus',
    core: '',
    extraArgs: [],
    gameDir: temp.dir,
    entry: '',
    entryArgs: [],
  };
}

const resolve = (entries: EntryRule[], romName: string, argsFile?: string) =>
  resolveGameFiles({
    profile: { entries, ...(argsFile ? { argsFile } : {}) },
    ctx: ctx(romName),
    exists: existsSync,
    list: (dir) => readdir(dir),
    readText: (path) => readFile(path, 'utf8'),
  });

describe('game files (FR-EMU-9)', () => {
  it('FR-EMU-9: Singe image — .singe wins over .zip', async () => {
    await files('Agent328OB.singe', 'Agent328OB.txt', 'Agent328OB.zip');
    expect((await resolve(singeRules, 'Agent328OB')).entryArgs).toEqual([
      '-script',
      join(temp.dir, 'Agent328OB.singe'),
    ]);
  });

  it('FR-EMU-9: a game zip of its own name is passed with -zlua', async () => {
    await files('crimepatrol.txt', 'crimepatrol.zip', 'other.zip');
    expect((await resolve(singeRules, 'crimepatrol')).entryArgs).toEqual([
      '-zlua',
      join(temp.dir, 'crimepatrol.zip'),
    ]);
  });

  it('FR-EMU-9: shared Lua zip — -zlua <the zip> -usealt <game>', async () => {
    await files('cpower1.txt', 'cpower2.txt', 'captainpower.zip');
    expect((await resolve(singeRules, 'cpower1')).entryArgs).toEqual([
      '-zlua',
      join(temp.dir, 'captainpower.zip'),
      '-usealt',
      'cpower1',
    ]);
  });

  it('FR-EMU-9: a * pattern takes the first match in alphabetical order, ignoring case', async () => {
    await files('b.ZIP', 'A.zip');
    expect((await resolve([singeRules[2] as EntryRule], 'x')).entryArgs[1]).toBe(
      join(temp.dir, 'A.zip'),
    );
  });

  it('FR-EMU-9: no rule matches → entryMissing naming what was looked for', async () => {
    await files('ghost.txt');
    const error = await resolve(singeRules.slice(0, 2), 'ghost').catch((e: unknown) => e);
    expect((error as AppErrorException).error).toMatchObject({
      code: 'LAUNCH_FAILED',
      details: {
        reason: 'entryMissing',
        looked: [join(temp.dir, 'ghost.singe'), join(temp.dir, 'ghost.zip')],
      },
    });
  });

  it('FR-EMU-9: no rules → no entry args and no error', async () => {
    expect(await resolve([], 'astron')).toEqual({ entryArgs: [], fileArgs: [] });
  });

  it('FR-EMU-9: Daphne .commands file becomes leading args; missing file → none', async () => {
    await writeFile(join(temp.dir, 'astron.commands'), '-sound_buffer 2048\r\n -nolinear_scale\n');
    expect((await resolve([], 'astron', '{gameDir}\\{romName}.commands')).fileArgs).toEqual([
      '-sound_buffer',
      '2048',
      '-nolinear_scale',
    ]);
    expect((await resolve([], 'ace', '{gameDir}\\{romName}.commands')).fileArgs).toEqual([]);
  });

  it('FR-EMU-9: names with spaces, parentheses and & stay one argv element', async () => {
    await files('Tom & Jerry (USA).singe');
    expect((await resolve(singeRules, 'Tom & Jerry (USA)')).entryArgs).toEqual([
      '-script',
      join(temp.dir, 'Tom & Jerry (USA).singe'),
    ]);
  });
});

describe('Hypseus Singe preset rules on real layouts (FR-EMU-9)', () => {
  const presetRules = (): EntryRule[] => {
    const profile = emulatorPresets()
      .flatMap((preset) => preset.profiles)
      .find((p) => p.id === 'hypseus:default');
    return [...(profile?.entries ?? [])];
  };
  const run = (rom: string, gameDir: string, romName: string) =>
    resolveGameFiles({
      profile: { entries: presetRules() },
      ctx: { ...ctx(romName), rom, romDir: temp.dir, gameDir },
      exists: existsSync,
      list: (dir) => readdir(dir),
      readText: (path) => readFile(path, 'utf8'),
    });

  it('a <game>.hypseus folder runs its .singe with -singedir <system folder>, as the runner did', async () => {
    // The script loads `singe/maddog-hd/*.singe`; Hypseus finds them only through -singedir.
    const folder = join(temp.dir, 'maddog-hd.hypseus');
    await mkdir(folder);
    for (const name of ['maddog-hd.singe', 'maddog-hd.zip', 'maddog-hd.txt']) {
      await writeFile(join(folder, name), 'x');
    }
    expect((await run(folder, folder, 'maddog-hd')).entryArgs).toEqual([
      '-singedir',
      temp.dir,
      '-script',
      join(folder, 'maddog-hd.singe'),
    ]);
  });

  it('a mounted image with both files runs its zip with -zlua, as the runner did', async () => {
    const mount = join(temp.dir, 'mount');
    await mkdir(mount);
    for (const name of ['Hambuster.singe', 'Hambuster.zip', 'Hambuster.txt']) {
      await writeFile(join(mount, name), 'x');
    }
    const image = join(temp.dir, 'Hambuster.wsquashfs');
    await writeFile(image, 'x');
    expect((await run(image, mount, 'Hambuster')).entryArgs).toEqual([
      '-zlua',
      join(mount, 'Hambuster.zip'),
    ]);
  });
});
