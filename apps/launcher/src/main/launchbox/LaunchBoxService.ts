import {
  AppErrorException,
  ERROR_CODES,
  type LaunchBoxStatus,
  type Settings,
} from '@nextlevel/shared';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { downloadFile } from '../catalog/downloadFile.ts';
import type { EmitEvent } from '../ipc/events.ts';
import { LaunchBoxIndex } from './LaunchBoxIndex.ts';
import type { BuildInWorker } from './workerBuild.ts';

export const LAUNCHBOX_METADATA_URL = 'https://gamesdb.launchbox-app.com/Metadata.zip';

export interface LaunchBoxServiceDeps {
  /** The portable data folder (D50); everything lives in `<dataDir>\launchbox\`. */
  dataDir: string;
  fetch: typeof fetch;
  emit: EmitEvent;
  settings: () => Settings;
  system: (systemId: string) => { scraper: { launchboxPlatform?: string | undefined } } | undefined;
  buildInWorker: BuildInWorker;
  log?: { warn(context: object, message: string): void };
}

const fail = (
  code: 'LAUNCHBOX_INDEX_MISSING' | 'NO_LAUNCHBOX_PLATFORM' | 'LAUNCHBOX_BUSY',
  details?: unknown,
): never => {
  throw new AppErrorException({ code, message: ERROR_CODES[code], details });
};

class DownloadFailed extends Error {}

/** Cleanup never throws: a locked file is replaced by the next build anyway. */
function removeQuietly(path: string): void {
  try {
    rmSync(path, { force: true });
  } catch {
    // Left for the next refresh, which overwrites it.
  }
}

function readQuietly(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * The LaunchBox Games Database download and its local index (FR-SCR-6). Refresh downloads
 * Metadata.zip (resumable `.part`), builds `launchbox.db.building` in a worker, then closes the
 * index in use and swaps the new file in (Windows can't replace an open file). A failure keeps
 * the previous index.
 */
export class LaunchBoxService {
  private current: LaunchBoxIndex | null;
  private state: LaunchBoxStatus['state'];
  private progress: number | null = null;
  private error: string | null = null;
  private busy = false;
  private work: { controller: AbortController; done: Promise<void> } | null = null;
  private lastEmitted = -1;
  /** A built index waits here while a batch is busy (it can't be swapped under it). */
  private pendingSwap = false;

  constructor(private readonly deps: LaunchBoxServiceDeps) {
    this.current = LaunchBoxIndex.open(this.path('launchbox.db'));
    this.state = this.current ? 'ready' : 'missing';
  }

  private path(name: string): string {
    return join(this.deps.dataDir, 'launchbox', name);
  }

  status(): LaunchBoxStatus {
    const info = this.current?.info();
    return {
      state: this.state,
      builtAt: info?.builtAt ?? null,
      games: info?.games ?? 0,
      progress: this.progress,
      error: this.error,
    };
  }

  private set(state: LaunchBoxStatus['state'], progress: number | null, error: string | null) {
    this.state = state;
    this.progress = progress;
    this.error = error;
    this.lastEmitted = -1;
    this.deps.emit('launchbox.changed', this.status());
  }

  private report(share: number) {
    this.progress = share;
    // At most one event per percent.
    if (share === 1 || share - this.lastEmitted >= 0.01) {
      this.lastEmitted = share;
      this.deps.emit('launchbox.changed', this.status());
    }
  }

  /** The index in use; LAUNCHBOX_INDEX_MISSING until one is built. */
  index(): LaunchBoxIndex {
    return this.current ?? fail('LAUNCHBOX_INDEX_MISSING');
  }

  /** The system's LaunchBox platform: the settings override, then the catalog. */
  platformOf(systemId: string): string {
    return (
      this.deps.settings().systems[systemId]?.launchboxPlatform ??
      this.deps.system(systemId)?.scraper.launchboxPlatform ??
      fail('NO_LAUNCHBOX_PLATFORM', { systemId })
    );
  }

  /** A batch is using the index: refresh is refused until it ends. */
  setBusy(busy: boolean): void {
    this.busy = busy;
    if (!busy && this.pendingSwap) {
      this.pendingSwap = false;
      try {
        this.swap();
        this.set(this.current ? 'ready' : 'missing', null, null);
      } catch (error) {
        this.deps.log?.warn({ err: String(error) }, 'LaunchBox index swap failed');
        this.current ??= LaunchBoxIndex.open(this.path('launchbox.db'));
        this.set('failed', null, ERROR_CODES.INTERNAL);
      }
    }
  }

  /** Closes the index in use, puts the built file in its place and opens it. */
  private swap(): void {
    this.current?.close();
    this.current = null;
    renameSync(this.path('launchbox.db.building'), this.path('launchbox.db'));
    this.current = LaunchBoxIndex.open(this.path('launchbox.db'));
    rmSync(this.path('Metadata.zip'), { force: true });
  }

  refresh(): LaunchBoxStatus {
    if (this.busy) fail('LAUNCHBOX_BUSY');
    if (this.work) return this.status();
    const controller = new AbortController();
    this.set('downloading', 0, null);
    const done = this.run(controller.signal).finally(() => {
      this.work = null;
    });
    this.work = { controller, done };
    return this.status();
  }

  cancel(): LaunchBoxStatus {
    this.work?.controller.abort();
    this.set(this.current ? 'ready' : 'missing', null, null);
    return this.status();
  }

  /** Resolves when no download or build is running (tests, shutdown). */
  async idle(): Promise<void> {
    await this.work?.done;
  }

  dispose(): void {
    this.work?.controller.abort();
    this.current?.close();
    this.current = null;
  }

  private async run(signal: AbortSignal): Promise<void> {
    const zip = this.path('Metadata.zip');
    const building = this.path('launchbox.db.building');
    try {
      mkdirSync(this.path(''), { recursive: true });
      if (!existsSync(zip)) await this.download(zip, signal);
      this.set('building', 0, null);
      await this.deps.buildInWorker(
        zip,
        building,
        (share) => {
          this.report(share);
        },
        signal,
      );
      signal.throwIfAborted();
      if (this.busy) {
        // A batch is reading the index: swap when it ends (setBusy(false)).
        this.pendingSwap = true;
        this.set(this.current ? 'ready' : 'missing', null, null);
        return;
      }
      this.swap();
      this.set(this.current ? 'ready' : 'missing', null, null);
    } catch (error) {
      removeQuietly(building);
      if (signal.aborted) return;
      this.deps.log?.warn({ err: String(error) }, 'LaunchBox database refresh failed');
      // A built index that can't be read again would fail every time: download it anew.
      if (!(error instanceof DownloadFailed)) removeQuietly(zip);
      this.current ??= LaunchBoxIndex.open(this.path('launchbox.db'));
      this.set(
        'failed',
        null,
        error instanceof DownloadFailed ? ERROR_CODES.LAUNCHBOX_DOWNLOAD : ERROR_CODES.INTERNAL,
      );
    }
  }

  private async download(zip: string, signal: AbortSignal): Promise<void> {
    const part = `${zip}.part`;
    const versionFile = `${part}.version`;
    let size: number;
    let version: string;
    try {
      const head = await this.deps.fetch(LAUNCHBOX_METADATA_URL, { method: 'HEAD', signal });
      size = Number(head.headers.get('content-length'));
      if (!head.ok || !Number.isFinite(size) || size <= 0) throw new Error('no size');
      version = head.headers.get('etag') ?? head.headers.get('last-modified') ?? String(size);
    } catch (error) {
      signal.throwIfAborted();
      throw new DownloadFailed(String(error));
    }
    // LaunchBox publishes a new file daily: a part of another day's file is started over.
    if (existsSync(part) && readQuietly(versionFile) !== version) removeQuietly(part);
    writeFileSync(versionFile, version);
    let received = 0;
    const result = await downloadFile({
      url: LAUNCHBOX_METADATA_URL,
      part,
      expectedSize: size,
      fetch: this.deps.fetch,
      signal,
      onBytes: (count) => {
        received += count;
        this.report(Math.min(1, received / size));
      },
    });
    if (result !== 'done') throw new DownloadFailed(result);
    renameSync(part, zip);
    removeQuietly(versionFile);
  }
}
