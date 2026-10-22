import {
  defaultSettings,
  type IpcEvent,
  type Settings,
  type SystemDefinition,
} from '@nextlevel/shared';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { tempDir, tempLibrary } from '../library/testing.ts';
import { SettingsService } from '../settings/SettingsService.ts';
import { settingsFixture } from '../settings/testing.ts';
import { ScanService, type ScanDeps } from './ScanService.ts';
import { system } from './testing.ts';
import { ScanCancelled, inProcessWalker, type Walker } from './walker.ts';

const LOCATION = '0192b2a0-0000-7000-8000-000000000001';
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const CATALOG = [
  system('nintendo-64', { defaultFolderName: 'Nintendo 64', extensions: ['z64'] }),
  system('sega-genesis', { defaultFolderName: 'Sega Genesis', extensions: ['md'] }),
  system('switched-off', { defaultFolderName: 'Off', extensions: ['zip'] }),
];

interface Options {
  systems?: Settings['systems'];
  catalog?: SystemDefinition[];
  createWalker?: () => Walker;
  wrapSettings?: (settings: SettingsService) => ScanDeps['settings'];
  folderExists?: ScanDeps['folderExists'];
  log?: ScanDeps['log'];
}

async function setup(options: Options = {}) {
  const temp = await tempDir('nextlevel-scan-');
  cleanups.push(temp.cleanup);
  const roms = join(temp.dir, 'roms');
  await mkdir(roms);
  const events: Array<{ event: IpcEvent; payload: unknown }> = [];
  const emit = (event: IpcEvent, payload: unknown) => {
    events.push({ event, payload });
  };
  const fixture = await settingsFixture({
    onChanged: (snapshot) => {
      emit('settings.changed', snapshot);
    },
  });
  cleanups.push(fixture.cleanup);
  const settings = new SettingsService(fixture.deps);
  await settings.load();
  await settings.save(
    {
      ...defaultSettings(),
      storage: {
        ...defaultSettings().storage,
        locations: [{ id: LOCATION, name: 'Roms', path: roms, priority: 1 }],
      },
      systems: options.systems ?? { 'nintendo-64': { enabled: true } },
    },
    0,
  );
  events.length = 0;
  const library = await tempLibrary();
  cleanups.push(library.cleanup);
  const scan = new ScanService({
    repo: library.repo,
    settings: options.wrapSettings?.(settings) ?? settings,
    catalog: () => options.catalog ?? CATALOG,
    createWalker: options.createWalker ?? inProcessWalker,
    folderExists:
      options.folderExists ??
      ((dir) =>
        stat(dir).then(
          (info) => info.isDirectory(),
          () => false,
        )),
    clock: () => new Date(Date.UTC(2026, 9, 21, 12, 0, 0)),
    emit,
    log: options.log ?? { error: () => undefined },
    newId: () => 'scan-1',
  });
  const write = async (rel: string, content = '') => {
    const path = join(roms, rel);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  };
  const run = async (systemIds?: string[]) => {
    await scan.start(systemIds);
    await scan.whenIdle();
    const last = scan.status().last;
    if (!last) throw new Error('no summary');
    return last;
  };
  return { roms, scan, settings, library, events, write, run };
}

describe('ScanService', () => {
  it('FR-LIB-3: a scan logs system folders it could not read', async () => {
    const logged: unknown[] = [];
    const { write, run, roms } = await setup({
      log: { error: (context) => logged.push(context) },
    });
    await write('Nintendo 64');
    const summary = await run(['nintendo-64']);
    expect(summary.outcome).toBe('completed');
    expect(logged).toEqual([{ systemId: 'nintendo-64', dirs: [join(roms, 'Nintendo 64')] }]);
  });

  it('FR-LIB-3: a scan adds the games of every enabled system and reports progress', async () => {
    const { write, run, events, library } = await setup();
    await write('Nintendo 64/Demo One.z64');
    await write('Nintendo 64/Sub/Demo Two.z64');
    const summary = await run();
    expect(summary).toMatchObject({
      scanId: 'scan-1',
      outcome: 'completed',
      systems: [
        { systemId: 'nintendo-64', present: 2, added: 2, moved: 0, restored: 0, missing: 0 },
      ],
      enabledSystemIds: [],
    });
    expect(events.map((e) => e.event)).toEqual([
      'scan.progress',
      'scan.progress',
      'library.changed',
      'scan.progress',
      'scan.finished',
    ]);
    expect(events[0]?.payload).toMatchObject({ systemsTotal: 1, systemId: null });
    expect(events[3]?.payload).toMatchObject({ systemsDone: 1, systemsTotal: 1, filesSeen: 2 });
    expect(library.repo.systemCounts()).toEqual([
      { systemId: 'nintendo-64', games: 2, missing: 0 },
    ]);
  });

  it('FR-LIB-3: scan all includes untouched systems whose folder exists and enables those with games', async () => {
    const { write, run, events, settings } = await setup({ systems: {} });
    await write('Sega Genesis/Demo.md');
    const summary = await run();
    expect(summary.systems.map((s) => s.systemId)).toEqual(['sega-genesis']);
    expect(summary.enabledSystemIds).toEqual(['sega-genesis']);
    const current = settings.get();
    expect(current.kind === 'ok' && current.snapshot.settings.systems).toEqual({
      'sega-genesis': { enabled: true },
    });
    expect(events.filter((e) => e.event === 'settings.changed')).toHaveLength(1);
  });

  it('FR-LIB-3: a system switched off is neither scanned nor re-enabled', async () => {
    const { write, run, settings } = await setup({
      systems: { 'switched-off': { enabled: false } },
    });
    await write('Off/Demo.zip');
    const summary = await run();
    expect(summary.systems).toEqual([]);
    expect(summary.enabledSystemIds).toEqual([]);
    const current = settings.get();
    expect(current.kind === 'ok' && current.snapshot.settings.systems).toEqual({
      'switched-off': { enabled: false },
    });
  });

  it('FR-LIB-4: a disconnected drive marks games missing; reconnecting restores the same rows', async () => {
    const { write, run, roms, library } = await setup();
    await write('Nintendo 64/Demo.z64');
    await run();
    const before = library.db.$client.prepare('select game_id, title from game_metadata').all();

    await rename(roms, `${roms}-away`);
    const gone = await run();
    expect(gone.systems).toEqual([
      { systemId: 'nintendo-64', present: 0, added: 0, moved: 0, restored: 0, missing: 1 },
    ]);
    expect(library.repo.systemCounts()).toEqual([
      { systemId: 'nintendo-64', games: 1, missing: 1 },
    ]);

    await rename(`${roms}-away`, roms);
    const back = await run();
    expect(back.systems[0]).toMatchObject({ present: 1, added: 0, restored: 1, missing: 0 });
    expect(library.db.$client.prepare('select game_id, title from game_metadata').all()).toEqual(
      before,
    );
  });

  it('FR-LIB-3: cancel stops the scan; the interrupted system is unchanged', async () => {
    let walks = 0;
    let started: () => void = () => undefined;
    const secondStarted = new Promise<void>((resolve) => (started = resolve));
    const createWalker = (): Walker => {
      const real = inProcessWalker();
      let reject: (error: unknown) => void = () => undefined;
      return {
        walk: (job) => {
          walks += 1;
          if (walks === 1) return real.walk(job);
          started();
          return new Promise((_resolve, rejectWalk) => (reject = rejectWalk));
        },
        stop: () => {
          reject(new ScanCancelled());
        },
      };
    };
    const { write, scan, library } = await setup({
      systems: { 'nintendo-64': { enabled: true }, 'sega-genesis': { enabled: true } },
      createWalker,
    });
    await write('Nintendo 64/Demo.z64');
    await write('Sega Genesis/Demo.md');

    await scan.start();
    await secondStarted;
    expect(scan.cancel().running).toBe(true);
    await scan.whenIdle();

    const status = scan.status();
    expect(status.running).toBe(false);
    expect(status.progress).toBeNull();
    expect(status.last).toMatchObject({
      outcome: 'cancelled',
      systems: [{ systemId: 'nintendo-64' }],
    });
    expect(library.repo.systemCounts()).toEqual([
      { systemId: 'nintendo-64', games: 1, missing: 0 },
    ]);
  });

  it('FR-LIB-3: starting while a scan runs returns the running status', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const createWalker = (): Walker => {
      const real = inProcessWalker();
      return { walk: async (job) => (await gate, real.walk(job)), stop: () => undefined };
    };
    const { scan } = await setup({ createWalker });
    const first = await scan.start();
    const second = await scan.start();
    expect(first.running).toBe(true);
    expect(second).toEqual(scan.status());
    release();
    await scan.whenIdle();
    expect(scan.status().last?.systems).toHaveLength(1);
  });

  it('FR-LIB-3: an unknown explicit system id is rejected', async () => {
    const { scan } = await setup();
    await expect(scan.start(['nope'])).rejects.toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(scan.status().running).toBe(false);
  });

  it('FR-LIB-3: a failing walk ends the scan as failed', async () => {
    const createWalker = (): Walker => ({
      walk: () => Promise.reject(new Error('disk on fire')),
      stop: () => undefined,
    });
    const { run } = await setup({ createWalker });
    expect((await run()).outcome).toBe('failed');
  });

  it('NFR-REL-1: a failed settings write still finishes the scan', async () => {
    const { write, run, scan, events } = await setup({
      systems: {},
      wrapSettings: (settings) => ({
        get: () => settings.get(),
        update: () => Promise.reject(new Error('EPERM: file locked')),
      }),
    });
    await write('Sega Genesis/Demo.md');
    const summary = await run();
    expect(summary).toMatchObject({ outcome: 'completed', enabledSystemIds: [] });
    expect(scan.status().running).toBe(false);
    expect(events.at(-1)?.event).toBe('scan.finished');
  });

  it('FR-LIB-3: enabling found systems never overwrites an entry saved meanwhile', async () => {
    const { write, run, settings } = await setup({
      systems: {},
      wrapSettings: (real) => ({
        get: () => real.get(),
        // The user's save lands in the queue just before the scan's update.
        update: async (change) => {
          const current = real.get();
          if (current.kind !== 'ok') throw new Error('not ok');
          await real.save(
            {
              ...current.snapshot.settings,
              systems: { 'sega-genesis': { enabled: false, folderName: 'Sega Genesis' } },
            },
            current.snapshot.revision,
          );
          return real.update(change);
        },
      }),
    });
    await write('Sega Genesis/Demo.md');
    expect((await run()).enabledSystemIds).toEqual([]);
    const current = settings.get();
    expect(current.kind === 'ok' && current.snapshot.settings.systems).toEqual({
      'sega-genesis': { enabled: false, folderName: 'Sega Genesis' },
    });
  });

  it('FR-LIB-3: a scan is running and cancellable while folders are still being checked', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { scan } = await setup({
      systems: {},
      folderExists: async () => {
        await gate;
        return true;
      },
    });
    const started = await scan.start();
    expect(started).toMatchObject({ running: true, progress: { systemId: null } });
    expect(scan.cancel().running).toBe(true);
    release();
    await scan.whenIdle();
    expect(scan.status().last).toMatchObject({ outcome: 'cancelled', systems: [] });
  });
});
