import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { win32 } from 'node:path';
import { launchError } from './errors.ts';

// FR-EMU-9: `.wsquashfs` images are mounted as a drive for the length of a game, never
// extracted. The tool (mountsquashfs.exe, "squashoverlay", WinFsp) runs until killed; killing it
// unmounts the drive. Writes go to a persistent overlay folder inside the launcher's data folder.

const TOOL_NAME = 'mountsquashfs.exe';
/** Drive letters tried for a mount, first free one wins (high letters are rarely in use). */
export const DRIVE_PREFERENCE = 'ZYXWVUTSQPONM'.split('');
const OUTPUT_LIMIT = 2048;

export interface MountedImage {
  /** The drive, without a separator: `Q:`. */
  root: string;
  /** Kills the tool and waits for the drive to go; safe to call more than once. */
  unmount(): Promise<void>;
}

export interface Mounter {
  mount(image: string, overlay: string): Promise<MountedImage>;
}

/** The running mount tool. */
export interface ToolProcess {
  pid: number;
  /** Resolves with the exit code when the tool ends. */
  exited: Promise<number | null>;
  /** The last part of what the tool printed. */
  output(): string;
  kill(): void;
}

export interface MountEntry {
  pid: number;
  drive: string;
  image: string;
}

/** The mounts this launcher started and hasn't released, kept in case it crashes. */
export interface MountRecord {
  add(entry: MountEntry): Promise<void>;
  remove(pid: number): Promise<void>;
  list(): Promise<MountEntry[]>;
}

interface Log {
  warn(context: object, msg: string): void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls until `done()` or the time is up; false when it timed out. */
async function waitFor(done: () => boolean, timeoutMs: number, pollMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (!done()) {
    if (Date.now() >= end) return false;
    await sleep(pollMs);
  }
  return true;
}

export function squashoverlayMounter(deps: {
  tool: string;
  spawnTool(tool: string, args: string[]): ToolProcess;
  /** Whether `<letter>:\` exists. */
  driveExists(letter: string): boolean;
  record: MountRecord;
  log: Log;
  mountTimeoutMs?: number;
  unmountTimeoutMs?: number;
  pollMs?: number;
}): Mounter {
  const mountTimeoutMs = deps.mountTimeoutMs ?? 10_000;
  const unmountTimeoutMs = deps.unmountTimeoutMs ?? 5_000;
  const pollMs = deps.pollMs ?? 50;
  return {
    async mount(image, overlay) {
      const failed = (output: string) =>
        launchError('LAUNCH_FAILED', { reason: 'mountFailed', path: image, stderrTail: output });
      const letter = DRIVE_PREFERENCE.find((candidate) => !deps.driveExists(candidate));
      if (!letter) throw failed('noFreeDrive');
      const drive = `${letter}:`;
      await mkdir(overlay, { recursive: true });
      const tool = deps.spawnTool(deps.tool, ['-drive', drive, '-overlay', overlay, image]);
      // An object, so TypeScript doesn't narrow it to its first value across the await.
      const state = { ended: false };
      void tool.exited.then(() => {
        state.ended = true;
      });
      await deps.record.add({ pid: tool.pid, drive, image });
      const appeared = await waitFor(
        () => state.ended || deps.driveExists(letter),
        mountTimeoutMs,
        pollMs,
      );
      if (!appeared || state.ended) {
        tool.kill();
        await deps.record.remove(tool.pid);
        throw failed(tool.output());
      }
      let released: Promise<void> | null = null;
      const release = async () => {
        tool.kill();
        const gone = await waitFor(() => !deps.driveExists(letter), unmountTimeoutMs, pollMs);
        if (!gone) deps.log.warn({ drive, image }, 'squashfs drive still there after unmounting');
        await deps.record.remove(tool.pid);
      };
      return {
        root: drive,
        unmount: () => (released ??= release()),
      };
    },
  };
}

/** Starts the real tool, hidden, without a shell. */
export function spawnMountTool(tool: string, args: string[]): ToolProcess {
  const child = spawn(tool, args, {
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const keep = (chunk: Buffer) => {
    output = (output + chunk.toString('utf8')).slice(-OUTPUT_LIMIT);
  };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  const exited = new Promise<number | null>((resolve) => {
    child.once('error', (error) => {
      keep(Buffer.from(error.message));
      resolve(null);
    });
    child.once('exit', (code) => {
      resolve(code);
    });
  });
  return {
    pid: child.pid ?? 0,
    exited,
    output: () => output.trim(),
    kill: () => {
      child.kill();
    },
  };
}

/** Mounts in a JSON file (`<data>\mounts.json`); an unreadable file counts as empty. */
export function fileMountRecord(path: string): MountRecord {
  let queue: Promise<unknown> = Promise.resolve();
  const read = async (): Promise<MountEntry[]> => {
    try {
      const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
      return Array.isArray(parsed) ? (parsed as MountEntry[]) : [];
    } catch {
      return [];
    }
  };
  const write = async (entries: MountEntry[]) => {
    const temp = `${path}.tmp`;
    await writeFile(temp, JSON.stringify(entries));
    await rename(temp, path);
  };
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work);
    queue = next.catch(() => undefined);
    return next;
  };
  return {
    add: (entry) => serial(async () => write([...(await read()), entry])),
    remove: (pid) => serial(async () => write((await read()).filter((entry) => entry.pid !== pid))),
    list: () => serial(read),
  };
}

/**
 * Releases mounts a crashed run left behind: a recorded PID is killed only while it is still the
 * mount tool (Windows reuses PIDs). The record is cleared either way.
 */
export async function sweepStaleMounts(deps: {
  record: MountRecord;
  processName(pid: number): Promise<string | null>;
  kill(pid: number): void;
  log: Log;
}): Promise<void> {
  for (const entry of await deps.record.list()) {
    const name = await deps.processName(entry.pid).catch(() => null);
    if (name?.toLowerCase() === TOOL_NAME) {
      try {
        deps.kill(entry.pid);
      } catch (error) {
        deps.log.warn({ error, pid: entry.pid }, 'could not stop a leftover squashfs mount');
      }
    }
    await deps.record.remove(entry.pid);
  }
}

/** The image name of a running process, via `tasklist` (no shell); null when it isn't running. */
export function windowsProcessName(pid: number): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      'tasklist',
      ['/FI', `PID eq ${String(pid)}`, '/FO', 'CSV', '/NH'],
      { windowsHide: true },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        const match = /^"([^"]+)"/.exec(stdout.trim());
        resolve(match?.[1] ?? null);
      },
    );
  });
}

/**
 * Where the mount tool is: the Settings path when it exists, else `<root>\tools\`, else the
 * `tools` folder next to the emulators folder (`<emulators>\<emu>\x.exe` → `<emulators>\..\tools`).
 */
export function findMountTool(o: {
  configured: string | null;
  root: string;
  emulatorExecutable: string;
  exists(path: string): boolean;
}): string | null {
  const nextLevel = win32.dirname(win32.dirname(win32.dirname(o.emulatorExecutable)));
  const candidates = [
    o.configured,
    win32.join(o.root, 'tools', TOOL_NAME),
    win32.join(nextLevel, 'tools', TOOL_NAME),
  ];
  return candidates.find((path): path is string => !!path && o.exists(path)) ?? null;
}

/** `<letter>:\` exists. */
export const driveExists = (letter: string) => existsSync(`${letter}:\\`);
