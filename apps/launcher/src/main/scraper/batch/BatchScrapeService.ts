import {
  AppErrorException,
  ERROR_CODES,
  IDLE_BATCH,
  type BatchPauseReason,
  type BatchRules,
  type BatchScope,
  type BatchStatus,
  type ScrapeApplyInput,
  type ScrapeApplyResult,
  type ScrapeSearchResult,
} from '@nextlevel/shared';
import type { EmitEvent } from '../../ipc/events.ts';
import type { GameRepository } from '../../library/GameRepository.ts';
import type { MediaRepository } from '../../library/MediaRepository.ts';
import type { LibraryDb } from '../../library/openLibrary.ts';
import type { ScrapeRepository } from '../../library/ScrapeRepository.ts';
import { JobStore, type Job, type Tally } from './jobStore.ts';
import { countGames, nextGame } from './nextGame.ts';
import { batchTargets, decide } from './rules.ts';

export interface BatchDeps {
  db: LibraryDb;
  scraper: {
    search: (input: { gameId: number }) => Promise<ScrapeSearchResult>;
    apply: (
      input: ScrapeApplyInput,
      opts: { candidates: number; regions?: string[]; batch: true },
    ) => Promise<ScrapeApplyResult>;
  };
  games: Pick<GameRepository, 'get'>;
  media: Pick<MediaRepository, 'kindsByGame'>;
  scrapes: Pick<ScrapeRepository, 'set'>;
  /** When the daily quota resets (QuotaGate), or null when unknown. */
  quota: () => { exhaustedUntil: string | null };
  /** A scan or import is running. */
  blocked: () => boolean;
  /** A system's ScreenScraper id (settings, then catalog), or null. */
  screenscraperId: (systemId: string) => number | null;
  emit: EmitEvent;
  log: { error(context: object, msg: string): void };
  clock: () => Date;
  sleep: (ms: number) => Promise<void>;
  /** Runs `run` after `ms`; returns a cancel function. */
  setTimer: (ms: number, run: () => void) => () => void;
}

/** Consecutive network failures before the job pauses (Review Focus 4). */
const NETWORK_TRIES = 3;
/** Games in a row whose art could not be saved before the job pauses (`media`). */
const MEDIA_TRIES = 3;
const BUSY_WAIT_MS = 5000;
const QUOTA_FALLBACK_MS = 60 * 60 * 1000;

const noSystem = (systemIds: string[]) =>
  new AppErrorException({
    code: 'NO_SCRAPER_SYSTEM',
    message: ERROR_CODES.NO_SCRAPER_SYSTEM,
    details: { systemIds },
  });

const busy = () =>
  new AppErrorException({ code: 'BUSY', message: ERROR_CODES.BUSY, details: { batch: true } });

/**
 * Batch scrape (FR-SCR-2, US-C6, D18): one persisted job, one game at a time. A game is applied
 * only on a hash match or a single candidate ≥ 90; otherwise it is marked for review (or not
 * found). Quota, bad credentials and repeated network loss pause the job — the current game is
 * retried on resume, never counted failed. A running job resumes when the app starts.
 */
export class BatchScrapeService {
  private readonly store: JobStore;
  private job: Job | null = null;
  private loop: Promise<void> = Promise.resolve();
  private stop: 'pause' | 'cancel' | null = null;
  private current: BatchStatus['current'] = null;
  private networkFails = 0;
  private mediaFails = 0;
  private cancelTimer: (() => void) | null = null;

  constructor(private readonly deps: BatchDeps) {
    this.store = new JobStore(deps.db);
  }

  status(): BatchStatus {
    const job = this.job;
    if (!job) return IDLE_BATCH;
    const state = job.status === 'cancelled' ? 'finished' : job.status;
    return {
      jobId: job.id,
      state,
      pausedReason: state === 'paused' ? job.pausedReason : null,
      resumeAt: state === 'paused' ? job.resumeAt : null,
      total: job.total,
      done: job.done,
      applied: job.applied,
      review: job.review,
      notFound: job.notFound,
      failed: job.failed,
      current: state === 'running' ? this.current : null,
    };
  }

  /** BUSY while a job runs or is paused, or a scan or import runs. */
  assertCanStart(): void {
    const status = this.job?.status;
    if (this.deps.blocked() || status === 'running' || status === 'paused') throw busy();
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- refusals reject, never throw
  async begin(scope: BatchScope, rules: BatchRules): Promise<BatchStatus> {
    this.assertCanStart();
    const unmapped = this.systemsOf(scope).filter((id) => this.deps.screenscraperId(id) === null);
    if (unmapped.length > 0) throw noSystem(unmapped);
    const total = countGames(this.deps.db, scope, rules);
    this.job = this.store.create(scope, rules, total, this.deps.clock());
    this.stop = null;
    this.networkFails = 0;
    this.drive();
    return this.status();
  }

  private systemsOf(scope: BatchScope): string[] {
    if ('systemIds' in scope) return [...new Set(scope.systemIds)];
    return this.deps.db.$client
      .prepare('select distinct system_id from games where id in (select value from json_each(?))')
      .pluck()
      .all(JSON.stringify(scope.gameIds)) as string[];
  }

  /** Stops after the current game. */
  pause(): BatchStatus {
    if (this.job?.status === 'running') this.stop = 'pause';
    return this.status();
  }

  resume(): Promise<BatchStatus> {
    const job = this.job;
    if (job?.status === 'paused') {
      this.clearTimer();
      Object.assign(job, { status: 'running', pausedReason: null, resumeAt: null });
      this.save();
      this.stop = null;
      this.networkFails = 0;
      this.drive();
    }
    return Promise.resolve(this.status());
  }

  /** A running job stops after the current game; a paused one at once. */
  cancel(): BatchStatus {
    const job = this.job;
    if (job?.status === 'running') this.stop = 'cancel';
    else if (job?.status === 'paused') {
      this.clearTimer();
      job.status = 'cancelled';
      this.save();
    }
    return this.status();
  }

  /** At launch: picks up a running job, or waits for a quota pause to end. */
  restore(): void {
    const job = this.store.active();
    if (!job) return;
    this.job = job;
    if (job.status === 'running') this.drive();
    else if (job.pausedReason === 'quota' && job.resumeAt) this.resumeAt(job.resumeAt);
    else this.emitProgress();
  }

  /** Resolves when the current run of the job has stopped (tests, quit). */
  async idle(): Promise<void> {
    let seen: Promise<void> | null = null;
    while (seen !== this.loop) {
      seen = this.loop;
      await seen;
    }
  }

  dispose(): void {
    this.clearTimer();
    this.stop = 'pause';
  }

  private running(): boolean {
    return this.job?.status === 'running';
  }

  private drive(): void {
    this.emitProgress();
    // Each run starts from a settled loop, and nothing here may reject: a rejected loop would
    // skip every later run until restart.
    this.loop = this.loop
      .catch(() => undefined)
      .then(() => this.run())
      .catch((error: unknown) => {
        this.stopped(error);
      });
  }

  /** The job must not stay "running" with no loop behind it. */
  private stopped(error: unknown): void {
    this.current = null;
    try {
      this.deps.log.error({ error, jobId: this.job?.id }, 'batch scrape stopped');
      if (this.job?.status === 'running') this.pauseFor('error', null);
    } catch {
      // The library can't be written either: keep the pause in memory; the row says running,
      // so the job resumes at the next launch.
      if (this.job?.status === 'running') {
        Object.assign(this.job, { status: 'paused', pausedReason: 'error', resumeAt: null });
      }
    }
  }

  private async run(): Promise<void> {
    while (this.job?.status === 'running') {
      const next = nextGame(this.deps.db, this.job);
      if (!next) {
        this.job.status = 'finished';
        this.save();
        break;
      }
      await this.handle(next.gameId);
      const stop = this.stop;
      this.stop = null;
      if (stop === 'cancel') {
        // Even when the game just paused the job (quota): a cancelled job never resumes.
        this.clearTimer();
        this.job.status = 'cancelled';
        this.save();
      } else if (stop === 'pause' && this.running()) {
        Object.assign(this.job, { status: 'paused', pausedReason: 'user' });
        this.save();
      }
    }
  }

  private async handle(gameId: number): Promise<void> {
    const game = this.deps.games.get(gameId);
    const job = this.job;
    if (!job) return;
    this.current = { gameId, title: game.title };
    this.emitProgress();
    try {
      const targets = batchTargets(job.rules, game, this.deps.media);
      if (targets.kinds.length === 0 && targets.fields.length === 0) {
        // Nothing this game may receive (e.g. only locked fields chosen): no request at all.
        this.advance(gameId, null);
        return;
      }
      const found = await this.deps.scraper.search({ gameId });
      const outcome = decide(found);
      if (outcome.kind === 'apply') {
        const result = await this.deps.scraper.apply(
          { gameId, providerGameId: outcome.providerGameId, ...targets },
          { candidates: found.candidates.length, regions: job.rules.regions, batch: true },
        );
        this.networkFails = 0;
        const unsaved =
          result.written.length === 0 && result.failed.some((f) => f.code === 'write');
        this.mediaFails = unsaved ? this.mediaFails + 1 : 0;
        const failed = unsaved || result.game.scrape?.status === 'failed';
        this.advance(gameId, failed ? 'failed' : 'applied');
        if (this.mediaFails >= MEDIA_TRIES) {
          this.mediaFails = 0;
          this.pauseFor('media', null);
        }
      } else {
        this.networkFails = 0;
        this.mark(gameId, game.systemId, outcome.kind, found.candidates.length, null);
        this.advance(gameId, outcome.kind);
      }
    } catch (error) {
      await this.onError(gameId, game.systemId, error);
    } finally {
      this.current = null;
    }
  }

  private async onError(gameId: number, systemId: string, error: unknown): Promise<void> {
    const code = error instanceof AppErrorException ? error.error.code : 'INTERNAL';
    if (code === 'SCRAPER_QUOTA') {
      const until =
        this.deps.quota().exhaustedUntil ??
        new Date(this.deps.clock().getTime() + QUOTA_FALLBACK_MS).toISOString();
      this.pauseFor('quota', until);
    } else if (code === 'SCRAPER_CREDENTIALS' || code === 'NO_CREDENTIALS') {
      this.pauseFor('credentials', null);
    } else if (code === 'SCRAPER_NETWORK' || code === 'SCRAPER_UNAVAILABLE') {
      this.networkFails += 1;
      if (this.networkFails >= NETWORK_TRIES) {
        this.networkFails = 0;
        this.pauseFor('network', null);
      } else {
        await this.deps.sleep(2000 * this.networkFails);
      }
    } else if (code === 'BUSY') {
      // A scan or import started: wait, then try the same game again.
      await this.deps.sleep(BUSY_WAIT_MS);
    } else {
      this.mark(gameId, systemId, 'failed', 0, code);
      this.advance(gameId, 'failed');
    }
  }

  private mark(
    gameId: number,
    systemId: string,
    status: 'review' | 'notFound' | 'failed',
    candidates: number,
    error: string | null,
  ): void {
    this.deps.scrapes.set(gameId, {
      status,
      providerGameId: null,
      candidates,
      error,
      scrapedAt: this.deps.clock().toISOString(),
    });
    this.deps.emit('library.changed', { systems: [systemId], gameIds: [gameId] });
  }

  /** `null`: the game needed nothing; it still counts as done. */
  private advance(gameId: number, tally: Tally | null): void {
    const job = this.job;
    if (!job) return;
    job.cursorGameId = gameId;
    job.done += 1;
    if (tally) job[tally] += 1;
    this.save();
  }

  private pauseFor(reason: BatchPauseReason, resumeAt: string | null): void {
    const job = this.job;
    if (!job) return;
    Object.assign(job, { status: 'paused', pausedReason: reason, resumeAt });
    this.save();
    if (resumeAt) this.resumeAt(resumeAt);
  }

  private resumeAt(at: string): void {
    this.clearTimer();
    const wait = Math.max(0, Date.parse(at) - this.deps.clock().getTime());
    this.cancelTimer = this.deps.setTimer(wait, () => {
      this.cancelTimer = null;
      void this.resume();
    });
    this.emitProgress();
  }

  private clearTimer(): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
  }

  private save(): void {
    if (this.job) this.store.save(this.job, this.deps.clock());
    this.emitProgress();
  }

  private emitProgress(): void {
    this.deps.emit('scraper.batch.progress', this.status());
  }
}
