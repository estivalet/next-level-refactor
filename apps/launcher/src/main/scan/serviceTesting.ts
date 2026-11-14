import {
  defaultSettings,
  type IpcEvent,
  type Settings,
  type StorageLocation,
  type SystemDefinition,
} from '@nextlevel/shared';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { MediaRepository } from '../library/MediaRepository.ts';
import { tempDir, tempLibrary } from '../library/testing.ts';
import { SettingsService } from '../settings/SettingsService.ts';
import { settingsFixture } from '../settings/testing.ts';
import { ScanService, type ScanDeps } from './ScanService.ts';
import { system } from './testing.ts';
import { inProcessWalker, type Walker } from './walker.ts';

export const LOCATION = '0192b2a0-0000-7000-8000-000000000001';

export const CATALOG = [
  system('nintendo-64', { defaultFolderName: 'Nintendo 64', extensions: ['z64'] }),
  system('sega-genesis', { defaultFolderName: 'Sega Genesis', extensions: ['md'] }),
  system('switched-off', { defaultFolderName: 'Off', extensions: ['zip'] }),
];

export interface ScanSetupOptions {
  /** More storage locations after `Roms`. */
  moreLocations?: StorageLocation[];
  systems?: Settings['systems'];
  catalog?: SystemDefinition[];
  createWalker?: () => Walker;
  wrapSettings?: (settings: SettingsService) => ScanDeps['settings'];
  folderExists?: ScanDeps['folderExists'];
  log?: ScanDeps['log'];
}

/** A ScanService over a temp library and settings with one storage location `<temp>/roms`. */
export async function setupScan(
  cleanups: Array<() => Promise<void>>,
  options: ScanSetupOptions = {},
) {
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
        locations: [
          { id: LOCATION, name: 'Roms', path: roms, priority: 1 },
          ...(options.moreLocations ?? []),
        ],
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
    media: new MediaRepository(library.db),
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
