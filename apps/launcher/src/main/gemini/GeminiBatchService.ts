import {
  AppErrorException,
  ERROR_CODES,
  GeminiBatchRulesSchema,
  IDLE_BATCH,
  type BatchPauseReason,
  type BatchRules,
  type BatchScope,
  type BatchStatus,
  type GeminiAnswer,
  type GeminiBatchRules,
  type GeminiField,
  type GeminiSource,
} from '@nextlevel/shared';
import type { EmitEvent } from '../ipc/events.ts';
import type { GameRepository } from '../library/GameRepository.ts';
import type { LibraryDb } from '../library/openLibrary.ts';
import { JobStore, type Job, type Tally } from '../scraper/batch/jobStore.ts';
import { countGames, nextGame } from '../scraper/batch/nextGame.ts';
import { checkAnswer } from './checks.ts';
import type { GeminiService } from './GeminiService.ts';
import type { PromptGame } from './prompt.ts';
import { nextQuotaReset } from './quotaReset.ts';

/** Games per Gemini request (saves the free daily allowance). */
export const GEMINI_BATCH_SIZE = 10;
const NETWORK_TRIES = 3;
const BUSY_WAIT_MS = 5000;

/** One request's raw answers by gameId (first one per id kept), unchecked. */
export interface SourceReply {
  items: Map<number, unknown>;
  sources: GeminiSource[];
  grounded: boolean;
}

/**
 * Where a batch's answers come from: the API client, or the website tool (Task 9), which gets
 * the whole remaining scope once through `prepare` so it starts Firefox once per run.
 */
export interface AnswerSource {
  prepare?: (
    jobId: number,
    games: PromptGame[],
    fields: GeminiField[],
    language: string,
  ) => Promise<void>;
  next: (games: PromptGame[], fields: GeminiField[], language: string) => Promise<SourceReply>;
  /** The run stopped (finished, paused, cancelled). */
  close?: () => void;
}

export interface GeminiBatchDeps {
  db: LibraryDb;
  gemini: Pick<GeminiService, 'record' | 'promptGame' | 'language'>;
  sources: { api: AnswerSource; web: AnswerSource };
  games: Pick<GameRepository, 'get'>;
  /** A scan or import is running. */
  blocked: () => boolean;
  emit: EmitEvent;
  log: { error(context: object, msg: string): void };
  clock: () => Date;
  sleep: (ms: number) => Promise<void>;
  setTimer: (ms: number, run: () => void) => () => void;
}

/** The scrape batch's game query, for "games with an empty requested field" (D19 locks kept). */
const asScrapeRules = (rules: GeminiBatchRules): BatchRules => ({
  onlyMissing: true,
  kinds: [],
  fields: rules.fields,
  regions: ['wor'],
  launchbox: false,
});

const busy = () => new AppErrorException({ code: 'BUSY', message: ERROR_CODES.BUSY });
const codeOf = (error: unknown) =>
  error instanceof AppErrorException ? error.error.code : 'INTERNAL';

/**
 * Fill details with Gemini, as a batch (FR-SCR-7, spec §7): up to 10 games per request, Review
 * or Auto-update, resumable; the daily limit pauses until Google's reset. Runs alongside the
 * scrape batch (its jobs are `source = 'gemini'`).
 */
export class GeminiBatchService {
  private readonly store: JobStore<GeminiBatchRules>;
  private job: Job<GeminiBatchRules> | null = null;
  private loop: Promise<void> = Promise.resolve();
  private stop: 'pause' | 'cancel' | null = null;
  private current: BatchStatus['current'] = null;
  private networkFails = 0;
  private disposed = false;
  private cancelTimer: (() => void) | null = null;

  constructor(private readonly deps: GeminiBatchDeps) {
    this.store = new JobStore(deps.db, 'gemini', (raw) => GeminiBatchRulesSchema.parse(raw));
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
      launchbox: 0,
      current: state === 'running' ? this.current : null,
      systemIds: 'systemIds' in job.scope ? [...new Set(job.scope.systemIds)] : null,
    };
  }

  start(scope: BatchScope, rules: GeminiBatchRules): Promise<BatchStatus> {
    const status = this.job?.status;
    if (this.deps.blocked() || status === 'running' || status === 'paused') {
      return Promise.reject(busy());
    }
    const total = countGames(this.deps.db, scope, asScrapeRules(rules));
    this.job = this.store.create(scope, rules, total, this.deps.clock());
    this.stop = null;
    this.networkFails = 0;
    this.drive();
    return Promise.resolve(this.status());
  }

  /** Stops after the current request. */
  pause(): BatchStatus {
    if (this.job?.status === 'running') this.stop = 'pause';
    return this.status();
  }

  resume(): Promise<BatchStatus> {
    const job = this.job;
    if (job?.status === 'paused' && !this.disposed) {
      this.clearTimer();
      Object.assign(job, { status: 'running', pausedReason: null, resumeAt: null });
      this.save();
      this.stop = null;
      this.networkFails = 0;
      this.drive();
    }
    return Promise.resolve(this.status());
  }

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

  /** At launch: picks up a running job, or waits for the daily limit to reset. */
  restore(): void {
    const job = this.store.active();
    if (!job) return;
    this.job = job;
    if (job.status === 'running') this.drive();
    else if (job.pausedReason === 'gemini-quota' && job.resumeAt) this.resumeAt(job.resumeAt);
    else this.emitProgress();
  }

  async idle(): Promise<void> {
    let seen: Promise<void> | null = null;
    while (seen !== this.loop) {
      seen = this.loop;
      await seen;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
    this.stop = 'pause';
  }

  private drive(): void {
    if (this.disposed) return;
    this.emitProgress();
    this.loop = this.loop
      .catch(() => undefined)
      .then(() => this.run())
      .catch((error: unknown) => {
        this.current = null;
        this.deps.log.error({ error, jobId: this.job?.id }, 'gemini batch stopped');
        if (this.job?.status === 'running') this.pauseFor('error', null);
      });
  }

  private source() {
    return this.job?.rules.route === 'web' ? this.deps.sources.web : this.deps.sources.api;
  }

  private async run(): Promise<void> {
    const job = this.job;
    if (!job) return;
    const source = this.source();
    const language = this.deps.gemini.language();
    try {
      if (source.prepare) {
        await source.prepare(job.id, this.remaining(Infinity), job.rules.fields, language);
      }
      await this.requests(source, language);
    } catch (error) {
      await this.onError([], error);
    } finally {
      source.close?.();
    }
  }

  private async requests(source: AnswerSource, language: string): Promise<void> {
    while (this.job?.status === 'running') {
      if (this.deps.blocked()) {
        await this.deps.sleep(BUSY_WAIT_MS);
        continue;
      }
      const games = this.remaining(GEMINI_BATCH_SIZE);
      if (games.length === 0) {
        this.job.status = 'finished';
        this.save();
        break;
      }
      const first = games[0];
      this.current = first ? { gameId: first.gameId, title: first.title } : null;
      this.emitProgress();
      try {
        const reply = await source.next(games, this.job.rules.fields, language);
        this.networkFails = 0;
        await this.recordAll(games, reply);
      } catch (error) {
        await this.onError(games, error);
      }
      this.afterRequest();
    }
    this.current = null;
  }

  /** The next games after the cursor (empty requested fields only), as the prompt shows them. */
  private remaining(limit: number): PromptGame[] {
    const job = this.job;
    if (!job) return [];
    const rules = asScrapeRules(job.rules);
    const games: PromptGame[] = [];
    let cursor = job.cursorGameId;
    while (games.length < limit) {
      const next = nextGame(this.deps.db, { scope: job.scope, rules, cursorGameId: cursor });
      if (!next) break;
      cursor = next.gameId;
      games.push(this.deps.gemini.promptGame(this.deps.games.get(next.gameId)));
    }
    return games;
  }

  private async recordAll(games: PromptGame[], reply: SourceReply): Promise<void> {
    const job = this.job;
    if (!job) return;
    for (const game of games) {
      const raw = reply.items.get(game.gameId);
      if (raw === undefined) {
        this.advance(game.gameId, 'notFound');
        continue;
      }
      const answer: GeminiAnswer = {
        gameId: game.gameId,
        route: job.rules.route,
        ...checkAnswer(raw, game, job.rules.fields, this.deps.clock()),
        sources: reply.sources,
        grounded: reply.grounded,
        askedAt: this.deps.clock().toISOString(),
      };
      try {
        const outcome = await this.deps.gemini.record(answer, job.rules.mode, job.rules.fields);
        this.advance(game.gameId, outcome === 'applied' ? 'applied' : outcome);
      } catch (error) {
        this.deps.log.error({ error, gameId: game.gameId }, 'gemini answer not saved');
        this.advance(game.gameId, 'failed');
      }
    }
  }

  /** Pauses for service-wide failures; a bad reply fails just this request's games. */
  private async onError(games: PromptGame[], error: unknown): Promise<void> {
    const code = codeOf(error);
    if (code === 'GEMINI_QUOTA') {
      this.pauseFor('gemini-quota', nextQuotaReset(this.deps.clock()).toISOString());
    } else if (code === 'GEMINI_NO_KEY' || code === 'GEMINI_KEY_REJECTED') {
      this.pauseFor('credentials', null);
    } else if (code === 'GEMINI_WEB_TOOL') {
      this.deps.log.error({ error, jobId: this.job?.id }, 'gemini website tool stopped');
      this.pauseFor('webTool', null);
    } else if (code === 'GEMINI_NETWORK') {
      this.networkFails += 1;
      if (this.networkFails >= NETWORK_TRIES) {
        this.networkFails = 0;
        this.pauseFor('network', null);
      } else {
        await this.deps.sleep(2000 * this.networkFails);
      }
    } else if (games.length > 0) {
      this.deps.log.error({ error, jobId: this.job?.id }, 'gemini request failed');
      for (const game of games) this.advance(game.gameId, 'failed');
    } else {
      throw error;
    }
  }

  private afterRequest(): void {
    const job = this.job;
    const stop = this.stop;
    this.stop = null;
    if (!job) return;
    if (stop === 'cancel') {
      this.clearTimer();
      job.status = 'cancelled';
      this.save();
    } else if (stop === 'pause' && job.status === 'running') {
      Object.assign(job, { status: 'paused', pausedReason: 'user' });
      this.save();
    }
  }

  private advance(gameId: number, tally: Tally): void {
    const job = this.job;
    if (!job) return;
    job.cursorGameId = gameId;
    job.done += 1;
    job[tally] += 1;
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
    this.deps.emit('gemini.batch.progress', this.status());
  }
}
