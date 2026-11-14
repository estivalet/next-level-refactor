import {
  AppErrorException,
  ERROR_CODES,
  type DownloadFailure,
  type DownloadGrant,
  type DownloadSummary,
  type PausedReason,
} from '@nextlevel/shared';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  toSummary,
  type DownloadRepository,
  type DownloadRow,
} from '../library/DownloadRepository.ts';
import { DiskWriteError } from './downloadFile.ts';
import { downloadItemFiles } from './downloadItemFiles.ts';
import {
  diskFree,
  freshItem,
  partSize,
  removeFolder,
  repairUnreadable,
  SAFE_ID,
  sha256Of,
  sweepFolders,
  verifyParts,
} from './downloadParts.ts';
import type { DownloadDeps } from './types.ts';

export type { DownloadDeps, DownloadLog } from './types.ts';

/** Why the running download was aborted: pause and cancel by the player, quit by the app. */
type Stop = 'pause' | 'cancel' | 'quit';

const PROGRESS_MS = 250;
/**
 * The catalog download queue (FR-CAT-4, D47, Review Focus 3): one download at a time, oldest
 * first; partial files resume with Range after a restart; an expired URL is asked for once more;
 * every file is checked against its size and SHA-256 (C9) before the installer gets it. Logs
 * carry ids and reasons, never a URL.
 */
export class DownloadService {
  readonly #deps: DownloadDeps;
  #running: { id: string; controller: AbortController; done: Promise<void> } | null = null;
  #loop: Promise<void> | null = null;
  #sweep: Promise<void> = Promise.resolve();
  /** Set by every kick: the loop looks for work again before it ends. */
  #kicked = false;
  readonly #lastProgress = new Map<string, number>();
  #disposed = false;

  constructor(deps: DownloadDeps) {
    this.#deps = deps;
  }

  /**
   * At boot: downloads cut off by quitting, or waiting for the network, run again; folders no
   * row points at (a cancel whose delete failed, a crash) are removed.
   */
  start(): void {
    this.#deps.repo.requeueInterrupted(this.#now());
    this.#sweep = this.#sweepOrphans();
    this.networkBack();
  }

  /** Resolves when the queue has nothing it can run (tests). */
  async idle(): Promise<void> {
    await this.#sweep;
    while (this.#loop) await this.#loop;
  }

  list(): DownloadSummary[] {
    return this.#deps.repo.list().map(toSummary);
  }

  /** Queues the item's current version (Install or Update, D42); an active download is reused. */
  async install(itemId: string): Promise<DownloadSummary> {
    const active = this.#deps.repo.activeFor(itemId);
    if (active) return toSummary(active);
    const item = await this.#deps.catalog.get(itemId);
    const failed = this.#deps.repo.failedFor(itemId);
    if (failed?.version === item.version) {
      await this.resume(failed.id);
      return toSummary(this.#row(failed.id));
    }
    if (failed) await this.#discard(failed.id);
    const row = this.#deps.repo.enqueue(this.#deps.newId(), item, this.#now());
    this.#progress(row, row.bytesDone, true);
    this.#kick();
    return toSummary(row);
  }

  async pause(id: string): Promise<void> {
    const row = this.#row(id);
    if (this.#running?.id === id) {
      this.#running.controller.abort('pause' satisfies Stop);
      return;
    }
    if (row.state !== 'queued') return;
    this.#set(row, { state: 'paused', pausedReason: 'user' });
    await Promise.resolve();
  }

  async resume(id: string): Promise<void> {
    const running = this.#running;
    // Paused a moment ago: the row says paused once the running download has stopped.
    if (running?.id === id && running.controller.signal.aborted) await running.done;
    const row = this.#row(id);
    if (row.state !== 'paused' && row.state !== 'failed') return;
    this.#set(row, { state: 'queued', pausedReason: null, error: null });
    this.#kick();
    await Promise.resolve();
  }

  async cancel(id: string): Promise<void> {
    const row = this.#row(id);
    if (this.#running?.id === id) {
      const { controller, done } = this.#running;
      controller.abort('cancel' satisfies Stop);
      // Only this download: the queue goes on without the caller waiting for it.
      await done;
      return;
    }
    await this.#discard(id);
    this.#deps.emit('downloads.finished', {
      downloadId: id,
      itemId: row.itemId,
      result: 'cancelled',
    });
  }

  /** Uninstall or lapse removal: the item's queued, running or paused download goes too. */
  async cancelItem(itemId: string): Promise<void> {
    const active = this.#deps.repo.activeFor(itemId);
    if (active) await this.cancel(active.id);
  }

  /**
   * The network or the session is back: downloads that paused for it continue. A player's pause
   * and a linked file's host limit (FR-CAT-9) wait for Resume.
   */
  networkBack(): void {
    for (const row of this.#deps.repo.list()) {
      if (
        row.state === 'paused' &&
        row.pausedReason !== 'user' &&
        row.pausedReason !== 'hostLimit'
      ) {
        this.#deps.repo.update(row.id, { state: 'queued', pausedReason: null }, this.#now());
      }
    }
    this.#kick();
  }

  /** Quitting: the running download stays `downloading`, so the next start resumes it. */
  dispose(): void {
    this.#disposed = true;
    this.#running?.controller.abort('quit' satisfies Stop);
  }

  #kick(): void {
    this.#kicked = true;
    if (this.#loop || this.#disposed) return;
    this.#loop = (async () => {
      while (this.#kicked && !this.#isDisposed()) {
        this.#kicked = false;
        await this.#dropUnreadable();
        for (
          let row = this.#deps.repo.next();
          row && !this.#isDisposed();
          row = this.#deps.repo.next()
        ) {
          await this.#run(row);
        }
      }
    })().finally(() => {
      this.#loop = null;
      // A kick that came while the loop was ending.
      if (this.#kicked) this.#kick();
    });
  }

  /** Read through a method: TS would keep the field narrowed across awaits. */
  #isDisposed(): boolean {
    return this.#disposed;
  }

  /** Rows an older launcher wrote (downloadParts.ts `repairUnreadable`). */
  async #dropUnreadable(): Promise<void> {
    await repairUnreadable(this.#deps, (id) => this.#discard(id));
  }

  async #sweepOrphans(): Promise<void> {
    await sweepFolders(this.#deps, new Set(this.#deps.repo.ids()));
  }

  async #removeFolder(id: string): Promise<void> {
    await removeFolder(this.#deps, id);
  }

  async #run(row: DownloadRow): Promise<void> {
    const controller = new AbortController();
    let finished: () => void = () => undefined;
    const done = new Promise<void>((resolve) => {
      finished = resolve;
    });
    this.#running = { id: row.id, controller, done };
    try {
      await this.#download(row, controller.signal);
    } catch (error) {
      const stop = controller.signal.aborted ? (controller.signal.reason as Stop) : null;
      if (stop === 'quit') return;
      if (stop === 'cancel') {
        await this.#discard(row.id);
        this.#deps.emit('downloads.finished', {
          downloadId: row.id,
          itemId: row.itemId,
          result: 'cancelled',
        });
        return;
      }
      if (stop === 'pause') {
        this.#pause(row, 'user');
        return;
      }
      if (error instanceof DiskWriteError) {
        this.#fail(row, 'write', { code: error.code });
        return;
      }
      this.#deps.log.error(
        { downloadId: row.id, itemId: row.itemId, error },
        'catalog download broke',
      );
      this.#fail(row, 'network');
    } finally {
      this.#running = null;
      finished();
      this.#lastProgress.delete(row.id);
    }
  }

  async #download(row: DownloadRow, signal: AbortSignal): Promise<void> {
    // File ids become part file names: anything but a plain id is refused (Review Focus 2).
    if (!row.item.files.every((file) => SAFE_ID.test(file.id))) {
      this.#fail(row, 'refused', { reason: 'fileId' });
      return;
    }
    const folder = join(this.#deps.dir, row.id);
    await mkdir(folder, { recursive: true });
    const part = (fileId: string) => join(folder, `${fileId}.part`);
    const sizes = await Promise.all(row.item.files.map((file) => partSize(part(file.id))));
    let done = sizes.reduce(
      (sum, size, i) => sum + Math.min(size, row.item.files[i]?.size ?? 0),
      0,
    );
    this.#set(row, { state: 'downloading', pausedReason: null, error: null, bytesDone: done });
    const free = await (this.#deps.freeSpace ?? diskFree)(this.#deps.dir);
    if (free < row.bytesTotal - done) {
      this.#fail(row, 'diskFull');
      return;
    }
    const outcome = await downloadItemFiles({
      files: row.item.files,
      part,
      fetch: this.#deps.fetch,
      signal,
      grant: () => this.#grant(row),
      onBytes: (count) => {
        done += count;
        this.#progress({ ...row, state: 'downloading' }, done, false);
      },
      // A whole-file answer to a ranged request: the part's earlier bytes no longer count.
      onRestart: (dropped) => {
        done -= dropped;
      },
    });
    if (outcome.kind === 'stopped') return;
    if (outcome.kind === 'pause') {
      this.#deps.repo.update(row.id, { bytesDone: done }, this.#now());
      this.#pause(row, outcome.reason);
      return;
    }
    if (outcome.kind === 'fail') {
      this.#fail(row, outcome.reason);
      return;
    }
    const verified = await this.#verify(row, part, signal);
    if (!verified) return;
    this.#progress({ ...row, state: 'downloading' }, row.bytesTotal, true);
    const item = await freshItem(this.#deps.catalog, row.item);
    // Paused or cancelled while verifying: nothing is installed (the parts stay for a pause).
    signal.throwIfAborted();
    try {
      await this.#deps.locks.run(row.itemId, () => this.#deps.installer.install(item, verified));
    } catch (error) {
      this.#deps.log.error(
        { downloadId: row.id, itemId: row.itemId, error },
        'catalog install failed',
      );
      this.#fail(row, 'write');
      return;
    }
    this.#deps.repo.delete(row.id);
    await this.#removeFolder(row.id);
    this.#deps.emit('downloads.finished', {
      downloadId: row.id,
      itemId: row.itemId,
      result: 'installed',
    });
  }

  /** Size and SHA-256 of every part (C9); a mismatching one is deleted and fails the download. */
  async #verify(row: DownloadRow, part: (fileId: string) => string, signal: AbortSignal) {
    const checked = await verifyParts(row.item.files, part, this.#deps.hash ?? sha256Of, signal);
    if ('mismatch' in checked) {
      this.#fail(row, 'checksum', { fileId: checked.mismatch });
      return null;
    }
    return checked.verified;
  }

  /** Signed URLs; no API pauses (offline), a refusal fails (refused). */
  async #grant(row: DownloadRow): Promise<DownloadGrant | null> {
    try {
      return await this.#deps.catalog.downloads(row.itemId);
    } catch (error) {
      if (error instanceof AppErrorException && error.error.code === 'API_UNREACHABLE') {
        this.#pause(row, 'offline');
        return null;
      }
      const code = error instanceof AppErrorException ? error.error.code : 'INTERNAL';
      this.#fail(row, 'refused', { code });
      return null;
    }
  }

  #pause(row: DownloadRow, reason: PausedReason): void {
    this.#deps.log.info(
      { downloadId: row.id, itemId: row.itemId, reason },
      'catalog download paused',
    );
    this.#set(row, { state: 'paused', pausedReason: reason });
  }

  #fail(row: DownloadRow, reason: DownloadFailure, context: Record<string, unknown> = {}): void {
    this.#deps.log.warn(
      { downloadId: row.id, itemId: row.itemId, reason, ...context },
      'catalog download failed',
    );
    this.#set(row, { state: 'failed', error: reason, pausedReason: null });
    this.#deps.emit('downloads.finished', {
      downloadId: row.id,
      itemId: row.itemId,
      result: 'failed',
      error: reason,
    });
  }

  #set(row: DownloadRow, patch: Parameters<DownloadRepository['update']>[1]): void {
    this.#deps.repo.update(row.id, patch, this.#now());
    const next = this.#row(row.id);
    this.#progress(next, next.bytesDone, true);
  }

  /** At most 4 a second per download, unless `force` (a state change). */
  #progress(row: DownloadRow, bytesDone: number, force: boolean): void {
    const now = this.#deps.clock().getTime();
    const last = this.#lastProgress.get(row.id);
    if (!force && last !== undefined && now - last < PROGRESS_MS) return;
    this.#lastProgress.set(row.id, now);
    this.#deps.emit('downloads.progress', {
      downloadId: row.id,
      itemId: row.itemId,
      bytesDone,
      bytesTotal: row.bytesTotal,
      state: row.state,
    });
  }

  /** The row goes first, so the loop can't pick it up while its folder is being deleted. */
  async #discard(id: string): Promise<void> {
    this.#deps.repo.delete(id);
    await this.#removeFolder(id);
  }

  #row(id: string): DownloadRow {
    const row = this.#deps.repo.get(id);
    if (!row) throw new AppErrorException({ code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND });
    return row;
  }

  #now(): string {
    return this.#deps.clock().toISOString();
  }
}
