import {
  AppErrorException,
  ERROR_CODES,
  type ScanProgress,
  type ScanStatus,
  type ScanSummary,
  type ScanSystemResult,
  type Settings,
  type SystemDefinition,
} from '@nextlevel/shared';
import type { EmitEvent } from '../ipc/events.ts';
import type { LibraryRepository } from '../library/LibraryRepository.ts';
import type { MediaRepository } from '../library/MediaRepository.ts';
import type { SettingsService } from '../settings/SettingsService.ts';
import { diffSystem } from './diff.ts';
import { matchMedia, type MediaFile } from './media.ts';
import { assertKnownSystems, planScan } from './plan.ts';
import { changesLibrary, systemResult } from './summary.ts';
import { ScanCancelled, type Walker } from './walker.ts';

export interface ScanDeps {
  repo: LibraryRepository;
  media: Pick<MediaRepository, 'replaceForSystem'>;
  settings: Pick<SettingsService, 'get' | 'update'>;
  catalog: () => readonly SystemDefinition[];
  createWalker: () => Walker;
  folderExists: (dir: string) => Promise<boolean>;
  clock: () => Date;
  emit: EmitEvent;
  log: { error(context: object, msg: string): void };
  newId: () => string;
}

interface Running {
  progress: ScanProgress;
  walker: Walker;
  cancelled: boolean;
  done: Promise<void>;
}

// Reads the flag through a call: TypeScript would otherwise narrow it across an await.
const isCancelled = (running: Running) => running.cancelled;

/**
 * Background scan (FR-LIB-3): walks each system in a worker, applies the diff in one transaction
 * per system, emits progress, and can be cancelled between systems.
 */
export class ScanService {
  private running: Running | null = null;
  private last: ScanSummary | null = null;

  constructor(private readonly deps: ScanDeps) {}

  status(): ScanStatus {
    return {
      running: this.running !== null,
      progress: this.running?.progress ?? null,
      last: this.last,
    };
  }

  /**
   * Starts a scan in the background and returns at once. Planning (checking which system folders
   * exist) is part of the scan, so a slow or offline drive shows "Starting…" and can be cancelled.
   */
  start(systemIds?: string[]): Promise<ScanStatus> {
    // Validation errors reject the promise instead of throwing at the call site.
    return Promise.resolve().then(() => this.begin(systemIds));
  }

  private begin(systemIds: string[] | undefined): ScanStatus {
    if (this.running) return this.status();
    const loaded = this.deps.settings.get();
    if (loaded.kind !== 'ok') {
      throw new AppErrorException({
        code: 'INVALID_SETTINGS',
        message: ERROR_CODES.INVALID_SETTINGS,
      });
    }
    if (systemIds) assertKnownSystems(this.deps.catalog(), systemIds);
    const running: Running = {
      progress: {
        scanId: this.deps.newId(),
        systemsDone: 0,
        systemsTotal: 0,
        systemId: null,
        filesSeen: 0,
      },
      walker: this.deps.createWalker(),
      cancelled: false,
      done: Promise.resolve(),
    };
    this.running = running;
    const startedAt = this.deps.clock().toISOString();
    running.done = this.run(running, loaded.snapshot.settings, systemIds, startedAt).catch(
      (error: unknown) => {
        this.deps.log.error({ error }, 'scan did not finish cleanly');
      },
    );
    return this.status();
  }

  cancel(): ScanStatus {
    const status = this.status();
    if (this.running) {
      this.running.cancelled = true;
      this.running.walker.stop();
    }
    return status;
  }

  /** Resolves when no scan is running. */
  whenIdle(): Promise<void> {
    return this.running?.done ?? Promise.resolve();
  }

  private async run(
    running: Running,
    settings: Settings,
    systemIds: string[] | undefined,
    startedAt: string,
  ): Promise<void> {
    const results: ScanSystemResult[] = [];
    let outcome: ScanSummary['outcome'] = 'completed';
    try {
      const jobs = await planScan(settings, this.deps.catalog(), systemIds, this.deps.folderExists);
      this.progress(running, { systemsTotal: jobs.length });
      for (const job of jobs) {
        if (running.cancelled) break;
        this.progress(running, { systemId: job.systemId });
        const walked = await running.walker.walk(job);
        // cancel() may have run while the walk was awaited.
        if (isCancelled(running)) break;
        if (walked.unreadable.length > 0) {
          this.deps.log.error(
            { systemId: job.systemId, dirs: walked.unreadable },
            'could not read system folders',
          );
        }
        const diff = diffSystem(this.deps.repo.listSystemGames(job.systemId), walked.files);
        this.deps.repo.applySystemDiff(job.systemId, diff, this.deps.clock());
        const mediaChanged = this.indexMedia(job.systemId, walked.media);
        const result = systemResult(job.systemId, diff);
        results.push(result);
        if (changesLibrary(result) || mediaChanged) {
          this.deps.emit('library.changed', { systems: [job.systemId] });
        }
        this.progress(running, {
          systemsDone: running.progress.systemsDone + 1,
          filesSeen: running.progress.filesSeen + walked.files.length,
        });
      }
    } catch (error) {
      if (!(error instanceof ScanCancelled)) {
        this.deps.log.error({ error, systemId: running.progress.systemId }, 'scan failed');
        outcome = 'failed';
      }
    } finally {
      running.walker.stop();
    }
    if (outcome === 'completed' && running.cancelled) outcome = 'cancelled';

    let enabledSystemIds: string[] = [];
    try {
      enabledSystemIds = await this.enableFound(results);
    } catch (error) {
      // A locked settings file must not leave the scan "running" forever.
      this.deps.log.error({ error }, 'could not enable scanned systems');
    }
    this.last = {
      scanId: running.progress.scanId,
      startedAt,
      finishedAt: this.deps.clock().toISOString(),
      outcome,
      systems: results,
      enabledSystemIds,
    };
    this.running = null;
    this.deps.emit('scan.finished', this.last);
  }

  /** Re-indexes the media of a system's present games (FR-THM-2); true when it changed. */
  private indexMedia(systemId: string, files: readonly MediaFile[]): boolean {
    const present = this.deps.repo.listSystemGames(systemId).filter((game) => !game.missing);
    return this.deps.media.replaceForSystem(systemId, matchMedia(present, files));
  }

  private progress(running: Running, change: Partial<ScanProgress>): void {
    running.progress = { ...running.progress, ...change };
    this.deps.emit('scan.progress', running.progress);
  }

  /**
   * Enables systems with games that the user never set either way, in one settings write. The
   * ids are chosen inside the update, against the latest settings, so a save that landed first
   * always wins.
   */
  private async enableFound(results: readonly ScanSystemResult[]): Promise<string[]> {
    const found = results.filter((r) => r.present > 0).map((r) => r.systemId);
    const loaded = this.deps.settings.get();
    if (loaded.kind !== 'ok') return [];
    if (found.every((id) => loaded.snapshot.settings.systems[id] !== undefined)) return [];
    let enabled: string[] = [];
    const saved = await this.deps.settings.update((current) => {
      enabled = found.filter((id) => current.systems[id] === undefined);
      const additions = Object.fromEntries(enabled.map((id) => [id, { enabled: true }]));
      return { ...current, systems: { ...current.systems, ...additions } };
    });
    if (saved.ok) return enabled;
    this.deps.log.error({ error: saved.error }, 'could not enable scanned systems');
    return [];
  }
}
