import {
  defaultSettings,
  type ArchiveMode,
  type IpcEvent,
  type IpcEventPayload,
  type Settings,
} from '@nextlevel/shared';
import { getSystem } from '@nextlevel/system-catalog';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, win32 } from 'node:path';
import { LaunchRepository } from '../library/LaunchRepository.ts';
import { seedGames, tempDir, tempLibrary } from '../library/testing.ts';
import type { Extractor } from './archives.ts';
import type { Mounter } from './squashfs.ts';
import type { LaunchCommand } from './buildCommand.ts';
import { launchError } from './errors.ts';
import { LaunchService } from './LaunchService.ts';
import type { SpawnFn } from './spawnProcess.ts';

/** The fake emulator script (test-strategy fixtures); run it with `process.execPath`. */
export const FAKE_EMULATOR = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'test',
  'fixtures',
  'fake-emulator.mjs',
);

export const EMULATOR_ID = '01900000-0000-7000-8000-0000000000e1';
export const PROFILE_ID = '01900000-0000-7000-8000-000000000001';
export const ROM_PATH = 'E:\\roms\\Nintendo 64\\Racer (USA).zip';

interface FakeSpawn {
  calls: LaunchCommand[];
  stderr: string;
  failNext: boolean;
  exit(code: number | null): void;
  spawn: SpawnFn;
}

/** A spawn whose process exits when the test says so. */
function fakeSpawn(): FakeSpawn {
  let exit: ((code: number | null) => void) | undefined;
  const fake: FakeSpawn = {
    calls: [],
    stderr: '',
    failNext: false,
    exit(code) {
      exit?.(code);
    },
    spawn: (command) => {
      fake.calls.push(command);
      if (fake.failNext) return Promise.reject(launchError('LAUNCH_FAILED', { reason: 'ENOENT' }));
      const exited = new Promise<{ exitCode: number | null }>((resolve) => {
        exit = (exitCode) => {
          resolve({ exitCode });
        };
      });
      return Promise.resolve({ exited, stderrTail: () => fake.stderr });
    },
  };
  return fake;
}

/** A LaunchService over a temp library with one N64 game, a fake spawn, clock and window. */
export async function launchHarness(options: { spawn?: SpawnFn; romFile?: string } = {}) {
  const library = await tempLibrary();
  const temp = await tempDir('nextlevel-launch-test-');
  const [gameId = 0] = seedGames(library.db, 'nintendo-64', [
    { title: 'Racer', relPath: options.romFile ?? 'Racer (USA).zip', locationId: 'loc-1' },
  ]);
  const settings: Settings = {
    ...defaultSettings(),
    storage: {
      ...defaultSettings().storage,
      locations: [{ id: 'loc-1', name: 'Main', path: 'E:\\roms', priority: 1 }],
    },
    emulators: [{ id: EMULATOR_ID, name: 'RetroArch', executable: 'E:\\emu\\retroarch.exe' }],
    profiles: [
      {
        id: PROFILE_ID,
        name: 'RetroArch – N64',
        emulatorId: EMULATOR_ID,
        systems: ['nintendo-64'],
        args: ['-L', '{emulatorDir}\\cores\\{core}.dll', '{rom}'],
        core: 'n64_libretro',
        archives: 'pass',
        squashfs: 'pass',
        entries: [],
        pointerExtensions: [],
        env: {},
      },
    ],
  };
  const romPath = `E:\\roms\\Nintendo 64\\${options.romFile ?? 'Racer (USA).zip'}`;
  const files = new Set(['E:\\emu', 'E:\\emu\\retroarch.exe', romPath]);
  let now = Date.UTC(2026, 9, 21, 12);
  const clock = { advance: (ms: number) => (now += ms) };
  const window = { calls: [] as string[] };
  const events: Array<{ event: IpcEvent; payload: unknown }> = [];
  const extractor: Extractor & { files: Record<string, number> } = {
    files: {},
    async extract(_archive, dest) {
      for (const [name, size] of Object.entries(extractor.files)) {
        await mkdir(dest, { recursive: true });
        await writeFile(join(dest, name), 'x'.repeat(size));
      }
    },
  };
  const spawn = fakeSpawn();
  /** A fake squashfs mounter: mounting adds `contents` under `root` to the visible files. */
  const mounts = {
    tool: 'E:\\NextLevel\\tools\\mountsquashfs.exe' as string | null,
    root: 'Q:',
    contents: [] as string[],
    calls: [] as Array<{ tool: string; image: string; overlay: string }>,
    unmounted: 0,
    fail: false,
    /** `unmount()` counts the call, then rejects (a failing cleanup). */
    failUnmount: false,
  };
  const mounterFor = (tool: string): Mounter => ({
    mount(image, overlay) {
      if (mounts.fail) {
        return Promise.reject(launchError('LAUNCH_FAILED', { reason: 'mountFailed', path: image }));
      }
      mounts.calls.push({ tool, image, overlay });
      for (const name of mounts.contents) files.add(`${mounts.root}\\${name}`);
      return Promise.resolve({
        root: mounts.root,
        unmount: () => {
          mounts.unmounted += 1;
          return mounts.failUnmount ? Promise.reject(new Error('EPERM')) : Promise.resolve();
        },
      });
    },
  });
  const dirs = new Set<string>();
  const texts = new Map<string, string>();
  const overlayRoot = join(temp.dir, 'squashfs-overlay');
  const launches = new LaunchRepository(library.db);
  const profile = () => settings.profiles[0] as Settings['profiles'][number];
  const emulator = () => settings.emulators[0] as Settings['emulators'][number];
  const service = new LaunchService({
    settings: () => settings,
    system: getSystem,
    launches,
    spawn: options.spawn ?? spawn.spawn,
    exists: (path) => files.has(path),
    clock: () => new Date(now),
    emit: <E extends IpcEvent>(event: E, payload: IpcEventPayload<E>) => {
      events.push({ event, payload });
    },
    window: {
      restore: () => window.calls.push('restore'),
    },
    extractor,
    tempDir: temp.dir,
    baseEnv: { PATH: 'C:\\Windows' },
    log: { warn: () => undefined, error: () => undefined },
    mountTool: () => mounts.tool,
    mounterFor,
    overlayRoot,
    isDirectory: (path) => dirs.has(path),
    list: (dir) =>
      Promise.resolve(
        [...files]
          .filter((file) => win32.dirname(file) === dir)
          .map((file) => win32.basename(file)),
      ),
    readText: (path) => Promise.resolve(texts.get(path) ?? ''),
  });
  return {
    library,
    launches,
    service,
    gameId,
    romPath,
    files,
    clock,
    window,
    events,
    extractor,
    spawn,
    mounts,
    dirs,
    texts,
    overlayRoot,
    tempDir: temp.dir,
    draft: () => structuredClone({ emulator: emulator(), profile: profile() }),
    setEmulatorExe(path: string) {
      emulator().executable = path;
      files.add(path);
      files.add(win32.dirname(path));
    },
    setProfileArgs(args: string[]) {
      profile().args = args;
    },
    setArchives(mode: ArchiveMode) {
      profile().archives = mode;
    },
    setPointerExtensions(extensions: string[]) {
      profile().pointerExtensions = extensions;
    },
    /** The Hypseus Singe preset (plan Task 6) on this harness's game. */
    useHypseusSinge() {
      emulator().executable = 'E:\\emu\\hypseus\\hypseus.exe';
      files.add(emulator().executable);
      files.add('E:\\emu\\hypseus');
      Object.assign(profile(), {
        args: [
          'singe',
          'vldp',
          '-framefile',
          '{gameDir}\\{romName}.txt',
          '{entryArgs}',
          '-fullscreen',
        ],
        squashfs: 'mount',
        entries: [
          { file: '{gameDir}\\{romName}.singe', args: ['-script', '{entry}'] },
          { file: '{gameDir}\\{romName}.zip', args: ['-zlua', '{entry}'] },
        ],
      });
    },
    cleanup: async () => {
      await library.cleanup();
      await temp.cleanup();
    },
  };
}
