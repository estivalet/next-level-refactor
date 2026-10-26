import { app, nativeImage } from 'electron';
import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultSettings } from '@nextlevel/shared';
import { emulatorPresets, getSystem, systemCatalog } from '@nextlevel/system-catalog';
import { path7za } from '7zip-bin';
import { v7 as uuidv7 } from 'uuid';
import { seedBuiltInSmartFilters } from './library/builtInSmartFilters.ts';
import { SmartFilterRepository } from './library/SmartFilterRepository.ts';
import { MenuRepository } from './menus/MenuRepository.ts';
import { ImportService } from './import/ImportService.ts';
import { detectEmulators } from './launch/detect.ts';
import { ImportRepository } from './library/ImportRepository.ts';
import { listBackupIds } from './settings/backups.ts';
import type { MainDeps } from './handlers.ts';
import { sevenZipExtractor } from './launch/archives.ts';
import { LaunchService } from './launch/LaunchService.ts';
import { spawnProcess } from './launch/spawnProcess.ts';
import { logger as log } from './log.ts';
import { CollectionRepository } from './library/CollectionRepository.ts';
import { expectedGamePath } from './library/expectedPath.ts';
import { GameRepository } from './library/GameRepository.ts';
import { LaunchRepository } from './library/LaunchRepository.ts';
import { LibraryRepository } from './library/LibraryRepository.ts';
import { MediaRepository } from './library/MediaRepository.ts';
import { openLibrary } from './library/openLibrary.ts';
import { FrontendService } from './frontend/FrontendService.ts';
import { ScanService } from './scan/ScanService.ts';
import scanWorkerPath from './scan/scanWorker.ts?modulePath';
import { createWorkerWalker } from './scan/workerWalker.ts';
import { hashRom } from './scraper/hashRom.ts';
import { MediaWriter } from './scraper/MediaWriter.ts';
import { BatchScrapeService } from './scraper/batch/BatchScrapeService.ts';
import { ScrapeService } from './scraper/ScrapeService.ts';
import type { ScreenScraperClient } from './scraper/screenscraper/client.ts';
import type { QuotaGate } from './scraper/screenscraper/quota.ts';
import { ScrapeRepository } from './library/ScrapeRepository.ts';
import type { EmitEvent } from './ipc/events.ts';
import type { SettingsService } from './settings/SettingsService.ts';

/** What the library needs from the app shell (index.ts). */
export interface LibraryHost {
  dataDir: string;
  emit: EmitEvent;
  menuWatch: { watch(fingerprint: () => string): void };
  launcherWindow: { minimize(): void; restore(): void };
}

export const currentSettings = (settings: SettingsService) => {
  const loaded = settings.get();
  return loaded.kind === 'ok' ? loaded.snapshot.settings : defaultSettings();
};

/** Opens `library.db`; without it the app still runs and library channels fail (M2b). */
export function startLibrary(
  settings: SettingsService,
  scraperClient: ScreenScraperClient,
  scraperQuota: Pick<QuotaGate, 'state'>,
  host: LibraryHost,
): MainDeps['library'] {
  const { dataDir, emit, menuWatch, launcherWindow } = host;
  let db: ReturnType<typeof openLibrary>;
  try {
    db = openLibrary(join(dataDir, 'library.db'), {
      backupsDir: join(dataDir, 'backups'),
      clock: () => new Date(),
    });
  } catch (error) {
    log.error({ error }, 'library could not be opened');
    return null;
  }
  const repo = new LibraryRepository(db);
  const media = new MediaRepository(db);
  const folderExists = (dir: string) =>
    stat(dir).then(
      (info) => info.isDirectory(),
      () => false,
    );
  const scan = new ScanService({
    repo,
    media,
    settings,
    catalog: systemCatalog,
    createWalker: () => createWorkerWalker(scanWorkerPath),
    folderExists,
    clock: () => new Date(),
    emit,
    log,
    newId: uuidv7,
  });
  // Paths follow the current settings, so a changed folder name or location applies at once.
  const games = new GameRepository(db, (row) => {
    const loaded = settings.get();
    return expectedGamePath({
      settings: loaded.kind === 'ok' ? loaded.snapshot.settings : defaultSettings(),
      system: systemCatalog().find((system) => system.id === row.systemId),
      ...row,
    });
  });
  const collections = new CollectionRepository(db, () => new Date());
  const launches = new LaunchRepository(db);
  const launch = new LaunchService({
    settings: () => currentSettings(settings),
    system: getSystem,
    launches,
    spawn: spawnProcess,
    exists: existsSync,
    clock: () => new Date(),
    emit,
    window: launcherWindow,
    // ADR-014: packaged builds run 7za.exe from outside the asar archive.
    extractor: sevenZipExtractor(path7za.replace('app.asar', 'app.asar.unpacked')),
    tempDir: app.getPath('temp'),
    baseEnv: process.env,
    log,
  });
  launch.cleanupStaleExtractions().catch((error: unknown) => {
    log.warn({ error }, 'could not remove old extraction folders');
  });
  // will-quit: after before-quit has let pending settings writes finish (start()).
  app.on('will-quit', () => {
    scan.cancel();
    db.$client.close();
  });
  const menus = new MenuRepository(db, () => new Date(), uuidv7);
  const smartFilters = new SmartFilterRepository(db, () => new Date());
  try {
    seedBuiltInSmartFilters(smartFilters, currentSettings(settings).general.language);
  } catch (error) {
    log.warn({ error }, 'could not create the built-in smart filters');
  }
  const frontend = new FrontendService({
    db,
    catalog: systemCatalog,
    settings: () => currentSettings(settings),
    collections,
    menus,
    smartFilters,
  });
  menuWatch.watch(() => frontend.menuFingerprint());
  const importer = new ImportService({
    catalog: systemCatalog(),
    presets: emulatorPresets(),
    settings,
    scan,
    repo: new ImportRepository(db),
    menus,
    emit,
    clock: () => new Date(),
    newId: uuidv7,
    detect: (folder) => detectEmulators(folder, emulatorPresets()),
    createWalker: () => createWorkerWalker(scanWorkerPath),
    folderExists,
    latestBackupId: async () => (await listBackupIds(settings.paths.backups))[0] ?? null,
  });
  const scrape = new ScrapeService({
    client: scraperClient,
    games,
    media,
    scrapes: new ScrapeRepository(db),
    writer: new MediaWriter({
      toPng: (bytes) => {
        const image = nativeImage.createFromBuffer(bytes);
        return image.isEmpty() ? null : image.toPNG();
      },
    }),
    transaction: (fn) => {
      db.$client.transaction(fn)();
    },
    settings: () => currentSettings(settings),
    system: getSystem,
    hash: (path) => hashRom(path),
    emit,
    clock: () => new Date(),
    blocked: () => scan.status().running || importer.running(),
  });
  const batch = new BatchScrapeService({
    db,
    scraper: scrape,
    games,
    media,
    scrapes: new ScrapeRepository(db),
    quota: () => scraperQuota.state(),
    blocked: () => scan.status().running || importer.running(),
    screenscraperId: (systemId) =>
      currentSettings(settings).systems[systemId]?.screenscraperId ??
      getSystem(systemId)?.scraper.screenscraperId ??
      null,
    emit,
    log,
    clock: () => new Date(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    setTimer: (ms, run) => {
      // setTimeout caps at ~24.8 days; a quota pause is at most a day.
      const timer = setTimeout(run, Math.min(ms, 2_147_000_000));
      return () => {
        clearTimeout(timer);
      };
    },
  });
  batch.restore();
  app.on('will-quit', () => {
    batch.dispose();
  });
  return {
    scrape,
    batch,
    repo,
    media,
    frontend,
    scan,
    games,
    collections,
    launches,
    launch,
    menus,
    smartFilters,
    importer,
  };
}
