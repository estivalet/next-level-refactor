import type { AppErrorException } from '@nextlevel/shared';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDir } from '../library/testing.ts';
import {
  driveExists,
  spawnMountTool,
  fileMountRecord,
  findMountTool,
  squashoverlayMounter,
  sweepStaleMounts,
  type MountRecord,
  type ToolProcess,
} from './squashfs.ts';

let temp: Awaited<ReturnType<typeof tempDir>>;
beforeEach(async () => {
  temp = await tempDir('nextlevel-squashfs-');
});
afterEach(async () => {
  await temp.cleanup();
});

const silent = { warn: () => undefined };

/** Drives that exist, and a fake mount tool that adds its drive after `delayMs` (or never). */
function world(o: {
  taken?: string[];
  delayMs?: number | null;
  exitCode?: number;
  output?: string;
}) {
  const drives = new Set(o.taken ?? []);
  const spawned: Array<{ tool: string; args: string[]; killed: boolean }> = [];
  let nextPid = 100;
  const spawnTool = (tool: string, args: string[]): ToolProcess => {
    const entry = { tool, args, killed: false };
    spawned.push(entry);
    const letter = (args[1] ?? '').charAt(0);
    let resolveExit: (code: number | null) => void = () => undefined;
    const exited = new Promise<number | null>((resolve) => {
      resolveExit = resolve;
    });
    if (o.exitCode !== undefined)
      setTimeout(() => {
        resolveExit(o.exitCode ?? 1);
      }, 5);
    else if (o.delayMs !== null) setTimeout(() => drives.add(letter), o.delayMs ?? 5);
    return {
      pid: nextPid++,
      exited,
      output: () => o.output ?? '',
      kill: () => {
        entry.killed = true;
        drives.delete(letter);
        resolveExit(null);
      },
    };
  };
  return { drives, spawned, spawnTool, driveExists: (letter: string) => drives.has(letter) };
}

function memoryRecord(): MountRecord & {
  entries: Array<{ pid: number; drive: string; image: string }>;
} {
  const entries: Array<{ pid: number; drive: string; image: string }> = [];
  return {
    entries,
    add: (entry) => {
      entries.push(entry);
      return Promise.resolve();
    },
    remove: (pid) => {
      const index = entries.findIndex((entry) => entry.pid === pid);
      if (index >= 0) entries.splice(index, 1);
      return Promise.resolve();
    },
    list: () => Promise.resolve([...entries]),
  };
}

const TOOL = 'E:\\NextLevel\\tools\\mountsquashfs.exe';
const IMAGE = 'E:\\roms\\Singe\\Agent328OB.wsquashfs';

function mounter(w: ReturnType<typeof world>, record = memoryRecord()) {
  return squashoverlayMounter({
    tool: TOOL,
    spawnTool: w.spawnTool,
    driveExists: w.driveExists,
    record,
    log: silent,
    mountTimeoutMs: 200,
    unmountTimeoutMs: 100,
    pollMs: 2,
  });
}

const failure = (error: unknown) => (error as AppErrorException).error;

describe('squashfs mounting (FR-EMU-9)', () => {
  it('FR-EMU-9: mounts on the first free preferred letter and passes the overlay', async () => {
    const w = world({ taken: ['Z'] });
    const overlay = join(temp.dir, 'overlay', 'singe', 'Agent328OB');
    const mounted = await mounter(w).mount(IMAGE, overlay);
    expect(mounted.root).toBe('Y:');
    expect(w.spawned[0]).toMatchObject({
      tool: TOOL,
      args: ['-drive', 'Y:', '-overlay', overlay, IMAGE],
    });
    expect(existsSync(overlay)).toBe(true);
  });

  it('FR-EMU-9: the tool exiting before the drive appears → mountFailed with its output', async () => {
    const w = world({ exitCode: 1, output: 'WinFsp is not installed' });
    const record = memoryRecord();
    const error = await mounter(w, record)
      .mount(IMAGE, join(temp.dir, 'ov'))
      .catch((e: unknown) => e);
    expect(failure(error)).toMatchObject({
      code: 'LAUNCH_FAILED',
      details: { reason: 'mountFailed', path: IMAGE, stderrTail: 'WinFsp is not installed' },
    });
    expect(record.entries).toEqual([]);
  });

  it('FR-EMU-9: drive never appears → mountFailed after the timeout and the tool is killed', async () => {
    const w = world({ delayMs: null });
    const error = await mounter(w)
      .mount(IMAGE, join(temp.dir, 'ov'))
      .catch((e: unknown) => e);
    expect(failure(error)).toMatchObject({ details: { reason: 'mountFailed' } });
    expect(w.spawned[0]?.killed).toBe(true);
  });

  it('FR-EMU-9: no free letter → mountFailed noFreeDrive, tool never started', async () => {
    const w = world({ taken: 'ZYXWVUTSQPONM'.split('') });
    const error = await mounter(w)
      .mount(IMAGE, join(temp.dir, 'ov'))
      .catch((e: unknown) => e);
    expect(failure(error)).toMatchObject({
      details: { reason: 'mountFailed', stderrTail: 'noFreeDrive' },
    });
    expect(w.spawned).toEqual([]);
  });

  it('FR-EMU-9: unmount kills the tool, waits for the drive to go, clears the record; twice is fine', async () => {
    const w = world({});
    const record = memoryRecord();
    const mounted = await mounter(w, record).mount(IMAGE, join(temp.dir, 'ov'));
    expect(record.entries).toEqual([{ pid: 100, drive: 'Z:', image: IMAGE }]);
    await mounted.unmount();
    await mounted.unmount();
    expect(w.spawned[0]?.killed).toBe(true);
    expect(w.drives.has('Z')).toBe(false);
    expect(record.entries).toEqual([]);
  });

  it('FR-EMU-9: start-up sweep kills only recorded PIDs that are still mountsquashfs.exe', async () => {
    const record = memoryRecord();
    await record.add({ pid: 10, drive: 'Z:', image: IMAGE });
    await record.add({ pid: 11, drive: 'Y:', image: IMAGE });
    const killed: number[] = [];
    await sweepStaleMounts({
      record,
      processName: (pid) =>
        Promise.resolve(pid === 10 ? 'MountSquashfs.exe' : pid === 11 ? 'notepad.exe' : null),
      kill: (pid) => killed.push(pid),
      log: silent,
    });
    expect(killed).toEqual([10]);
    expect(record.entries).toEqual([]);
  });

  it('FR-EMU-9: the mount record survives in a file and an unreadable file is empty', async () => {
    const path = join(temp.dir, 'mounts.json');
    const record = fileMountRecord(path);
    await record.add({ pid: 1, drive: 'Z:', image: IMAGE });
    await record.add({ pid: 2, drive: 'Y:', image: IMAGE });
    await record.remove(1);
    expect(await fileMountRecord(path).list()).toEqual([{ pid: 2, drive: 'Y:', image: IMAGE }]);
    await writeFile(path, '{not json');
    expect(await fileMountRecord(path).list()).toEqual([]);
    await fileMountRecord(path).add({ pid: 3, drive: 'X:', image: IMAGE });
    expect(JSON.parse(await readFile(path, 'utf8'))).toHaveLength(1);
  });

  it('FR-EMU-9: the mount tool is found in Settings, then <root>\\tools, then next to the emulators folder', () => {
    const configured = 'D:\\my\\mountsquashfs.exe';
    const rootTool = 'E:\\NextLevel\\tools\\mountsquashfs.exe';
    const besideEmulators = 'F:\\NL\\tools\\mountsquashfs.exe';
    const find = (present: string[], setting: string | null = configured) =>
      findMountTool({
        configured: setting,
        root: 'E:\\NextLevel',
        emulatorExecutable: 'F:\\NL\\emulators\\hypseus_singe\\hypseus.exe',
        exists: (path) => present.includes(path),
      });
    expect(find([configured, rootTool, besideEmulators])).toBe(configured);
    expect(find([rootTool, besideEmulators])).toBe(rootTool);
    expect(find([besideEmulators], null)).toBe(besideEmulators);
    expect(find([])).toBeNull();
  });
});

// The owner's PC only: the real tool and image (never written: the overlay is a temp folder).
const REAL_TOOL = 'E:\\NextLevel\\tools\\mountsquashfs.exe';
const REAL_IMAGE = 'E:\\NextLevel\\systems\\Daphne\\astron.wsquashfs';
describe.skipIf(!!process.env['CI'] || !existsSync(REAL_TOOL) || !existsSync(REAL_IMAGE))(
  'squashfs mounting with the real tool',
  () => {
    it('FR-EMU-9: mounts astron, shows its framefile, and the drive is gone after unmount', async () => {
      const real = squashoverlayMounter({
        tool: REAL_TOOL,
        spawnTool: spawnMountTool,
        driveExists,
        record: memoryRecord(),
        log: silent,
      });
      const mounted = await real.mount(REAL_IMAGE, join(temp.dir, 'overlay'));
      try {
        expect(existsSync(`${mounted.root}\\astron.txt`)).toBe(true);
      } finally {
        await mounted.unmount();
      }
      expect(existsSync(`${mounted.root}\\`)).toBe(false);
    }, 20_000);
  },
);
