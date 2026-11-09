import { app, nativeImage } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultSettings } from '@nextlevel/shared';
import {
  emulatorPresets,
  findSystem,
  systemCatalog,
  withCustomSystems,
} from '@nextlevel/system-catalog';
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
import {
  driveExists,
  fileMountRecord,
  findMountTool,
  spawnMountTool,
  squashoverlayMounter,
  sweepStaleMounts,
  windowsProcessName,
} from './launch/squashfs.ts';
import { logger as log } from './log.ts';
import { CollectionRepository } from './library/CollectionRepository.ts';
import { expectedGamePath } from './library/expectedPath.ts';
import { GameExportReader } from './library/GameExportReader.ts';
import { GameRepository, type ResolvePath } from './library/GameRepository.ts';
import { LaunchRepository } from './library/LaunchRepository.ts';
import { LibraryRepository } from './library/LibraryRepository.ts';
import { MediaRepository } from './library/MediaRepository.ts';
import { openLibrary, type LibraryDb } from './library/openLibrary.ts';
import { FrontendService } from './frontend/FrontendService.ts';
import { ScanService } from './scan/ScanService.ts';
import scanWorkerPath from './scan/scanWorker.ts?modulePath';
import indexWorkerPath from './launchbox/indexWorker.ts?modulePath';
import { LaunchBoxScrapeService } from './launchbox/LaunchBoxScrapeService.ts';
import { LaunchBoxService } from './launchbox/LaunchBoxService.ts';
import { buildInWorker } from './launchbox/workerBuild.ts';
import { createWorkerWalker } from './scan/workerWalker.ts';
import { hashRom } from './scraper/hashRom.ts';
import { MediaWriter } from './scraper/MediaWriter.ts';
import { BatchScrapeService } from './scraper/batch/BatchScrapeService.ts';
import { ScrapeService } from './scraper/ScrapeService.ts';
import type { ScreenScraperClient } from './scraper/screenscraper/client.ts';
import type { QuotaGate } from './scraper/screenscraper/quota.ts';
import { ScrapeRepository } from './library/ScrapeRepository.ts';
import type { EmitEvent } from './ipc/events.ts';
import { libraryCloser } from './library/libraryCloser.ts';
import { AnswerStore } from './gemini/AnswerStore.ts';
import { GeminiClient } from './gemini/GeminiClient.ts';
import { GeminiService } from './gemini/GeminiService.ts';
import { GeminiBatchService } from './gemini/GeminiBatchService.ts';
import { WebToolSource } from './gemini/WebToolSource.ts';
import { apiSource } from './gemini/apiSource.ts';
import type { SettingsService } from './settings/SettingsService.ts';

/** What the library needs from the app shell (index.ts). */
export interface LibraryHost {
  dataDir: string;
  /** The NextLevel folder (D50); its `tools` folder may hold the squashfs mount tool. */
  root: string;
  emit: EmitEvent;
  menuWatch: { watch(fingerprint: () => string): void };
  launcherWindow: { restore(): void };
  /** `<data>\temp` (D50), emptied at boot. */
  tempDir: string;
  /** The environment emulators start with (TMP/TEMP as the player had them). */
  baseEnv: NodeJS.ProcessEnv;
  /** The NextLevel folder moved since last boot: media paths follow (D50). */
  moved: { from: string; to: string } | null;
  /** The Gemini API key from the OS secret store (FR-SCR-7); null when not set. */
  geminiKey?: () => Promise<string | null>;
  /** The library is open: the catalog (M9e) builds on its database and repositories. */
  onOpened?: (parts: {
    db: LibraryDb;
    games: GameRepository;
    media: MediaRepository;
    /** Runs at quit before the database closes (the download queue stops first). */
    beforeClose: (step: () => void) => void;
  }) => void;
}

export const currentSettings = (settings: SettingsService) => {
  const loaded = settings.get();
  return loaded.kind === 'ok' ? loaded.snapshot.settings : defaultSettings();
};

/** The shipped catalog plus the user's systems (FR-EMU-11), from the current settings. */
export const currentSystems = (settings: SettingsService) =>
  withCustomSystems(systemCatalog(), currentSettings(settings).customSystems);

/** Opens `library.db`; without it the app still runs and library channels fail (M2b). */
export function startLibrary(
  settings: SettingsService,
  scraperClient: ScreenScraperClient,
  scraperQuota: Pick<QuotaGate, 'state'>,
  host: LibraryHost,
): MainDeps['library'] {
  const { dataDir, emit, menuWatch, launcherWindow, tempDir, baseEnv, moved } = host;
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
  const systems = () => currentSystems(settings);
  const systemById = (id: string) => findSystem(systems(), id);
  const media = new MediaRepository(db);
  if (moved) {
    try {
      log.info(
        { changed: media.relocate(moved.from, moved.to) },
        'media paths followed the folder',
      );
    } catch (error) {
      log.warn({ error }, 'media paths could not follow the moved folder');
    }
  }
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
  const scan = new ScanService({
    repo,
    media,
    settings,
    catalog: systems,
    createWalker: () => createWorkerWalker(scanWorkerPath),
    folderExists,
    clock: () => new Date(),
    emit,
    log,
    newId: uuidv7,
  });
  // Paths follow the current settings, so a changed folder name or location applies at once.
  const gamePath: ResolvePath = (row) => {
    const loaded = settings.get();
    return expectedGamePath({
      settings: loaded.kind === 'ok' ? loaded.snapshot.settings : defaultSettings(),
      system: systemById(row.systemId),
      ...row,
    });
  };
  const games = new GameRepository(db, gamePath);
  const exports = new GameExportReader(db, gamePath, (id) => systemById(id)?.name ?? id);
  const collections = new CollectionRepository(db, () => new Date());
  const launches = new LaunchRepository(db);
  // FR-EMU-9: a crashed run may have left a mount behind; the record lives in the data folder.
  const mountRecord = fileMountRecord(join(dataDir, 'mounts.json'));
  // e2e only (development builds): "mounting" shows this folder as the drive; releasing it
  // leaves `unmounted.txt` there.
  const fakeMount = app.isPackaged ? undefined : process.env['NEXTLEVEL_E2E_FAKE_MOUNT'];
  const launch = new LaunchService({
    settings: () => currentSettings(settings),
    system: systemById,
    launches,
    spawn: spawnProcess,
    exists: existsSync,
    clock: () => new Date(),
    emit,
    window: launcherWindow,
    // ADR-014: packaged builds run 7za.exe from outside the asar archive.
    extractor: sevenZipExtractor(path7za.replace('app.asar', 'app.asar.unpacked')),
    tempDir,
    baseEnv,
    log,
    mountTool: (emulator) =>
      fakeMount
        ? 'fake-mount'
        : findMountTool({
            configured: currentSettings(settings).tools.squashfsMount,
            root: host.root,
            emulatorExecutable: emulator.executable,
            exists: existsSync,
          }),
    mounterFor: (tool) =>
      fakeMount
        ? {
            mount: () =>
              Promise.resolve({
                root: fakeMount,
                unmount: () => writeFile(join(fakeMount, 'unmounted.txt'), 'released'),
              }),
          }
        : squashoverlayMounter({
            tool,
            spawnTool: spawnMountTool,
            driveExists,
            record: mountRecord,
            log,
          }),
    overlayRoot: join(dataDir, 'squashfs-overlay'),
    isDirectory: (path) => {
      try {
        return statSync(path).isDirectory();
      } catch {
        return false;
      }
    },
    list: (dir) => readdir(dir),
    readText: (path) => readFile(path, 'utf8'),
  });
  sweepStaleMounts({
    record: mountRecord,
    processName: windowsProcessName,
    kill: (pid) => process.kill(pid),
    log,
  }).catch((error: unknown) => {
    log.warn({ error }, 'could not release old squashfs mounts');
  });
  launch.cleanupStaleExtractions().catch((error: unknown) => {
    log.warn({ error }, 'could not remove old extraction folders');
  });
  // will-quit: after before-quit has let pending settings writes finish (start()).
  const closer = libraryCloser(() => {
    db.$client.close();
  });
  app.on('will-quit', () => {
    scan.cancel();
    closer.close();
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
    catalog: systems,
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
    fileExists,
    listFiles: (dir) => readdir(dir).catch(() => []),
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
    system: systemById,
    hash: (path) => hashRom(path),
    emit,
    clock: () => new Date(),
    blocked: () => scan.status().running || importer.running(),
  });
  // FR-SCR-6: the LaunchBox database lives in <data>\launchbox\ (D50).
  const launchbox = new LaunchBoxService({
    dataDir,
    fetch: (input, init) => fetch(input, init),
    emit,
    settings: () => currentSettings(settings),
    system: systemById,
    buildInWorker: buildInWorker(indexWorkerPath),
    log,
    // e2e points LaunchBox at a local fake; packaged builds never read the variables.
    ...launchboxDev('NEXTLEVEL_LAUNCHBOX_URL', (metadataUrl) => ({ metadataUrl })),
  });
  const launchboxScrape = new LaunchBoxScrapeService({
    launchbox,
    fetch: (input, init) => fetch(input, init),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
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
    system: systemById,
    emit,
    clock: () => new Date(),
    blocked: () => scan.status().running || importer.running(),
    ...launchboxDev('NEXTLEVEL_LAUNCHBOX_IMAGES', (imagesUrl) => ({ imagesUrl })),
  });
  // FR-SCR-7: Gemini fills missing details; the key never leaves main.
  const geminiClient = new GeminiClient({
    fetch: (input, init) => fetch(input, init),
    key: host.geminiKey ?? (() => Promise.resolve(null)),
    settings: () => currentSettings(settings).scraper.gemini,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    ...launchboxDev('NEXTLEVEL_GEMINI_URL', (baseUrl) => ({ baseUrl })),
  });
  const gemini = new GeminiService({
    client: geminiClient,
    answers: new AnswerStore(db),
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
    systemName: (systemId) => systemById(systemId)?.name ?? systemId,
    emit,
    clock: () => new Date(),
  });
  const batch = new BatchScrapeService({
    db,
    scraper: scrape,
    launchbox: {
      scraper: launchboxScrape,
      setBusy: (busy) => {
        launchbox.setBusy(busy);
      },
    },
    games,
    media,
    scrapes: new ScrapeRepository(db),
    quota: () => scraperQuota.state(),
    blocked: () => scan.status().running || importer.running(),
    screenscraperId: (systemId) =>
      currentSettings(settings).systems[systemId]?.screenscraperId ??
      systemById(systemId)?.scraper.screenscraperId ??
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
  // FR-SCR-7: the website route runs tools/gemini-web (Python + Selenium, the owner's fallback).
  const webSource = new WebToolSource({
    dataDir,
    toolPath: geminiToolPath(host.root),
    settings: () => currentSettings(settings).scraper.gemini,
    spawn: (command, args, options) => spawn(command, args, options),
    // Python, geckodriver and Firefox together: Firefox must let go of the profile.
    killTree: (pid) => {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
          shell: false,
          windowsHide: true,
        }).on('error', (error) => {
          log.warn({ error, pid }, 'could not stop the gemini website tool');
        });
      } else {
        process.kill(pid);
      }
    },
    log,
    poll: () => new Promise((resolve) => setTimeout(resolve, 500)),
  });
  const geminiBatch = new GeminiBatchService({
    db,
    gemini,
    sources: { api: apiSource(geminiClient), web: webSource },
    games,
    blocked: () => scan.status().running || importer.running(),
    grounded: () => currentSettings(settings).scraper.gemini.grounding,
    emit,
    log,
    clock: () => new Date(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    setTimer: (ms, run) => {
      const timer = setTimeout(run, ms);
      return () => {
        clearTimeout(timer);
      };
    },
  });
  batch.restore();
  geminiBatch.restore();
  closer.beforeClose(() => {
    geminiBatch.dispose();
    batch.dispose();
    launchbox.dispose();
  });
  host.onOpened?.({
    db,
    games,
    media,
    beforeClose: (step) => {
      closer.beforeClose(step);
    },
  });
  return {
    scrape,
    batch,
    launchbox,
    launchboxScrape,
    gemini,
    geminiClient,
    geminiBatch,
    repo,
    media,
    frontend,
    scan,
    games,
    exports,
    collections,
    launches,
    launch,
    menus,
    smartFilters,
    importer,
  };
}

/** A dev-only override from the environment (e2e fakes: LaunchBox, Gemini); nothing in packaged builds. */
function launchboxDev<T>(name: string, make: (value: string) => T): T | Record<string, never> {
  const value = app.isPackaged ? undefined : process.env[name];
  return value ? make(value) : {};
}

/**
 * tools/gemini-web/gemini_web.py: in the NextLevel folder's `tools` when it's there (D50), else
 * the repo copy next to the app in development.
 */
function geminiToolPath(root: string): string {
  const portable = join(root, 'tools', 'gemini-web', 'gemini_web.py');
  if (app.isPackaged || existsSync(portable)) return portable;
  return join(app.getAppPath(), '..', '..', 'tools', 'gemini-web', 'gemini_web.py');
}
