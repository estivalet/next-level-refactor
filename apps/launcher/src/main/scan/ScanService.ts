import {
  AppErrorException,
  ERROR_CODES,
  type ScanProgress,
  type ScanStatus,
  type ScanSummary,
  type ScanSystemResult,
  type SystemDefinition,
} from '@nextlevel/shared';
import type { EmitEvent } from '../ipc/events.ts';
import type { LibraryRepository } from '../library/LibraryRepository.ts';
import type { SettingsService } from '../settings/SettingsService.ts';
import { diffSystem } from './diff.ts';
import { planScan } from './plan.ts';
import { changesLibrary, systemResult } from './summary.ts';
import type { WalkJob } from './types.ts';
import { ScanCancelled, type Walker } from './walker.ts';

export interface ScanDeps {
  repo: LibraryRepository;
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

  async start(systemIds?: string[]): Promise<ScanStatus> {
    if (this.running) return this.status();
    const loaded = this.deps.settings.get();
    if (loaded.kind !== 'ok') {
      throw new AppErrorException({
        code: 'INVALID_SETTINGS',
        message: ERROR_CODES.INVALID_SETTINGS,
      });
    }
    const jobs = await planScan(
      loaded.snapshot.settings,
      this.deps.catalog(),
      systemIds,
      this.deps.folderExists,
    );
    // Planning awaited the file system; another start may have won meanwhile.
    if (this.busy()) return this.status();
    const progress = {
      scanId: this.deps.newId(),
      systemsDone: 0,
      systemsTotal: jobs.length,
      systemId: null,
      filesSeen: 0,
    };
    const running: Running = {
      progress,
      walker: this.deps.createWalker(),
      cancelled: false,
      done: Promise.resolve(),
    };
    this.running = running;
    running.done = this.run(running, jobs, this.deps.clock().toISOString());
    return this.status();
  }

  private busy(): boolean {
    return this.running !== null;
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

  private async run(running: Running, jobs: WalkJob[], startedAt: string): Promise<void> {
    const results: ScanSystemResult[] = [];
    let outcome: ScanSummary['outcome'] = 'completed';
    try {
      for (const job of jobs) {
        if (running.cancelled) break;
        this.progress(running, { systemId: job.systemId });
        const walked = await running.walker.walk(job);
        // cancel() may have run while the walk was awaited.
        if (isCancelled(running)) break;
        const diff = diffSystem(this.deps.repo.listSystemGames(job.systemId), walked.files);
        this.deps.repo.applySystemDiff(job.systemId, diff, this.deps.clock());
        const result = systemResult(job.systemId, diff);
        results.push(result);
        if (changesLibrary(result)) this.deps.emit('library.changed', { systems: [job.systemId] });
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

    const enabledSystemIds = await this.enableFound(results);
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

  private progress(running: Running, change: Partial<ScanProgress>): void {
    running.progress = { ...running.progress, ...change };
    this.deps.emit('scan.progress', running.progress);
  }

  /** Enables systems with games that the user never set either way, in one settings write. */
  private async enableFound(results: readonly ScanSystemResult[]): Promise<string[]> {
    const loaded = this.deps.settings.get();
    if (loaded.kind !== 'ok') return [];
    const systems = loaded.snapshot.settings.systems;
    const ids = results
      .filter((r) => r.present > 0 && systems[r.systemId] === undefined)
      .map((r) => r.systemId);
    if (ids.length === 0) return [];
    const saved = await this.deps.settings.update((settings) => ({
      ...settings,
      systems: {
        ...settings.systems,
        ...Object.fromEntries(ids.map((id) => [id, { enabled: true }])),
      },
    }));
    if (saved.ok) return ids;
    this.deps.log.error({ error: saved.error }, 'could not enable scanned systems');
    return [];
  }
}
