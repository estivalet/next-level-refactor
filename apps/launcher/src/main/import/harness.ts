import type { ImportSummary, IpcEvent, IpcEventPayload } from '@nextlevel/shared';
import { emulatorPresets, systemCatalog } from '@nextlevel/system-catalog';
import type Database from 'better-sqlite3';
import { stat } from 'node:fs/promises';
import { detectEmulators } from '../launch/detect.ts';
import { CollectionRepository } from '../library/CollectionRepository.ts';
import { GameRepository } from '../library/GameRepository.ts';
import { MediaRepository } from '../library/MediaRepository.ts';
import { tempLibrary } from '../library/testing.ts';
import { MenuRepository } from '../menus/MenuRepository.ts';
import { ScanService } from '../scan/ScanService.ts';
import { inProcessWalker } from '../scan/walker.ts';
import { listBackupIds } from '../settings/backups.ts';
import { SettingsService } from '../settings/SettingsService.ts';
import { settingsFixture } from '../settings/testing.ts';
import { ImportRepository } from '../library/ImportRepository.ts';
import { ImportService } from './ImportService.ts';
import { legacyCopy, type LegacyCopy } from './testing.ts';

const folderExists = (dir: string) =>
  stat(dir).then(
    (info) => info.isDirectory(),
    () => false,
  );
const fileExists = (path: string) =>
  stat(path).then(
    (info) => info.isFile(),
    () => false,
  );

export interface ImportHarness {
  copy: LegacyCopy;
  client: Database.Database;
  settings: SettingsService;
  scan: ScanService;
  menus: MenuRepository;
  collections: CollectionRepository;
  games: GameRepository;
  service: ImportService;
  events: Array<{ event: IpcEvent; payload: unknown }>;
  /** Dry run then apply, as the UI does. */
  run: (emulatorsFolder?: string | null) => Promise<ImportSummary>;
  count: (sql: string) => number;
  gameId: (systemId: string, relPath: string) => number | undefined;
  cleanup: () => Promise<void>;
}

/** A real library, settings, scan and import service over a fresh fixture copy (C5). */
export async function importHarness(): Promise<ImportHarness> {
  const copy = await legacyCopy();
  const library = await tempLibrary();
  const fixture = await settingsFixture();
  const settings = new SettingsService(fixture.deps);
  await settings.load();
  const events: Array<{ event: IpcEvent; payload: unknown }> = [];
  const emit = <E extends IpcEvent>(event: E, payload: IpcEventPayload<E>) => {
    events.push({ event, payload });
  };
  const clock = () => new Date(Date.UTC(2026, 9, 24, 12, 0, 0));
  let n = 0;
  const newId = () => `01900000-0000-7000-8000-${String(++n).padStart(12, '0')}`;
  const scan = new ScanService({
    repo: library.repo,
    media: new MediaRepository(library.db),
    settings,
    catalog: systemCatalog,
    createWalker: inProcessWalker,
    folderExists,
    clock,
    emit,
    log: { error: () => undefined },
    newId,
  });
  const menus = new MenuRepository(library.db, clock, newId);
  const collections = new CollectionRepository(library.db, clock);
  const games = new GameRepository(library.db, (row) => row.relPath);
  const service = new ImportService({
    catalog: systemCatalog(),
    presets: emulatorPresets(),
    settings,
    scan,
    repo: new ImportRepository(library.db),
    menus,
    emit,
    clock,
    newId,
    detect: (folder) => detectEmulators(folder, emulatorPresets()),
    createWalker: inProcessWalker,
    folderExists,
    fileExists,
    latestBackupId: async () => (await listBackupIds(settings.paths.backups))[0] ?? null,
  });
  const client: Database.Database = library.db.$client;
  return {
    copy,
    client,
    settings,
    scan,
    menus,
    collections,
    games,
    service,
    events,
    run: async (emulatorsFolder: string | null = null) => {
      const report = await service.dryRun(copy.data, emulatorsFolder);
      return service.apply(copy.data, emulatorsFolder, report.token);
    },
    count: (sql: string) => (client.prepare(sql).pluck().get() as number | undefined) ?? 0,
    gameId: (systemId: string, relPath: string) =>
      client
        .prepare('select id from games where system_id = ? and rel_path = ?')
        .pluck()
        .get(systemId, relPath) as number | undefined,
    cleanup: async () => {
      await settings.idle();
      await library.cleanup();
      await fixture.cleanup();
      await copy.cleanup();
    },
  };
}
