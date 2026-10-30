import { getSystem } from '@nextlevel/system-catalog';
import { nativeImage } from 'electron';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import type { ApiClient } from '../auth/ApiClient.ts';
import type { AuthService } from '../auth/AuthService.ts';
import type { EmitEvent } from '../ipc/events.ts';
import { CatalogInstallRepository } from '../library/CatalogInstallRepository.ts';
import { DownloadRepository } from '../library/DownloadRepository.ts';
import type { GameRepository } from '../library/GameRepository.ts';
import type { MediaRepository } from '../library/MediaRepository.ts';
import type { LibraryDb } from '../library/openLibrary.ts';
import { MediaWriter } from '../scraper/MediaWriter.ts';
import type { SettingsService } from '../settings/SettingsService.ts';
import { currentSettings } from '../startLibrary.ts';
import { createCatalogApi } from './catalogApi.ts';
import { CatalogClient } from './CatalogClient.ts';
import { CatalogSync } from './CatalogSync.ts';
import { DownloadService, type DownloadLog } from './DownloadService.ts';
import { fetchArt } from './fetchArt.ts';
import { Installer } from './Installer.ts';
import { ItemLocks } from './itemLocks.ts';
import { managedLocationOf } from './managedLocation.ts';

/** How often downloads that paused for the network try again. */
const RETRY_MS = 60_000;

/**
 * Wires the launcher's catalog (M9e): API client, download queue, installer and the lapse sync.
 * Downloads live in `<data>\downloads` and games in the Catalog games folder inside the
 * NextLevel folder (D50). The sync runs after every entitlement check that reached the API.
 */
export function startCatalog(o: {
  db: LibraryDb;
  /** Quit steps run before library.db closes (startLibrary). */
  beforeClose: (step: () => void) => void;
  games: GameRepository;
  media: MediaRepository;
  settings: SettingsService;
  /** The NextLevel folder: the default Catalog folder is `<root>\Catalog`. */
  root: string;
  dataDir: string;
  api: ApiClient;
  session: AuthService;
  emit: EmitEvent;
  log: DownloadLog;
  /** e2e only (development builds): hold each file request back this long, so it can be paused. */
  fileDelayMs?: number;
}): ReturnType<typeof createCatalogApi> {
  const delay = o.fileDelayMs ?? 0;
  const fileFetch: typeof fetch =
    delay > 0
      ? async (input, init) => {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, delay);
            init?.signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(init.signal?.reason as Error);
            });
          });
          return fetch(input, init);
        }
      : fetch;
  const client = new CatalogClient(o.api, o.session);
  const locks = new ItemLocks();
  const installs = new CatalogInstallRepository(o.db);
  const managedLocation = managedLocationOf({
    current: () => currentSettings(o.settings),
    update: (change) => o.settings.update(change),
    root: o.root,
    newId: uuidv7,
    mkdir: (path) => mkdir(path, { recursive: true }),
  });
  // The Catalog row shows in Settings → Storage before the first install.
  managedLocation().catch((error: unknown) => {
    o.log.warn({ error }, 'the Catalog games folder could not be set up');
  });
  const installer = new Installer({
    db: o.db,
    games: o.games,
    media: o.media,
    writer: new MediaWriter({
      toPng: (bytes) => {
        const image = nativeImage.createFromBuffer(bytes);
        return image.isEmpty() ? null : image.toPNG();
      },
    }),
    settings: () => currentSettings(o.settings),
    managedLocation,
    system: getSystem,
    fetchArt: (url) => fetchArt(url, fetch),
    clock: () => new Date(),
    emit: o.emit,
    log: o.log,
  });
  const downloads = new DownloadService({
    repo: new DownloadRepository(o.db),
    catalog: client,
    installer,
    dir: join(o.dataDir, 'downloads'),
    fetch: fileFetch,
    emit: o.emit,
    log: o.log,
    clock: () => new Date(),
    newId: uuidv7,
    locks,
  });
  const online = () => {
    const state = o.session.state();
    return state.kind === 'signedIn' && !state.offline;
  };
  const sync = new CatalogSync({
    installs,
    client,
    installer,
    cancelDownload: (itemId) => downloads.cancelItem(itemId),
    locks,
    canSync: online,
    emit: o.emit,
    log: o.log,
  });
  const stopChecked = o.session.onChecked(() => {
    downloads.networkBack();
    sync.sync().catch((error: unknown) => {
      o.log.warn({ error }, 'catalog sync failed');
    });
  });
  const retry = setInterval(() => {
    if (online()) downloads.networkBack();
  }, RETRY_MS);
  void mkdir(join(o.dataDir, 'downloads'), { recursive: true })
    .then(() => {
      downloads.start();
    })
    .catch((error: unknown) => {
      o.log.error({ error }, 'downloads folder could not be made');
    });
  // Before library.db closes: a download stopping mid-way still writes its row.
  o.beforeClose(() => {
    clearInterval(retry);
    stopChecked();
    downloads.dispose();
  });
  return createCatalogApi({
    client,
    downloads,
    installer,
    installs,
    locks,
    fetchArt: (url) => fetchArt(url, fetch),
  });
}
