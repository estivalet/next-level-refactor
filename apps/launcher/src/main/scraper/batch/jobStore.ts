import {
  BatchRulesSchema,
  BatchScopeSchema,
  type BatchPauseReason,
  type BatchRules,
  type BatchScope,
} from '@nextlevel/shared';
import type { LibraryDb } from '../../library/openLibrary.ts';

export type JobState = 'running' | 'paused' | 'finished' | 'cancelled';
export type Tally = 'applied' | 'review' | 'notFound' | 'failed';

export type JobSource = 'scrape' | 'gemini';

/** A `scrape_jobs` row in memory; `R` is the source's rules (BatchRules or GeminiBatchRules). */
export interface Job<R = BatchRules> {
  id: number;
  scope: BatchScope;
  rules: R;
  status: JobState;
  cursorGameId: number | null;
  total: number;
  done: number;
  applied: number;
  review: number;
  notFound: number;
  failed: number;
  /** FR-SCR-6: games LaunchBox wrote to. */
  launchbox: number;
  pausedReason: BatchPauseReason | null;
  resumeAt: string | null;
}

interface Row extends Omit<Job<unknown>, 'scope' | 'rules'> {
  scope: string;
  rules: string;
}

const COLUMNS = `id, scope, rules, status, cursor_game_id as cursorGameId, total, done, applied,
  review, not_found as notFound, failed, launchbox, paused_reason as pausedReason,
  resume_at as resumeAt`;

/**
 * Batch jobs in `scrape_jobs` (FR-SCR-2): one row per job, saved after every game. Each store
 * sees only its own source's rows (FR-SCR-7: the Gemini batch keeps its own jobs).
 */
export class JobStore<R = BatchRules> {
  constructor(
    private readonly db: LibraryDb,
    private readonly source: JobSource = 'scrape',
    private readonly parseRules: (raw: unknown) => R = (raw) => BatchRulesSchema.parse(raw) as R,
  ) {}

  create(scope: BatchScope, rules: R, total: number, now: Date): Job<R> {
    const at = now.toISOString();
    const { lastInsertRowid } = this.db.$client
      .prepare(
        `insert into scrape_jobs (scope, rules, status, total, source, created_at, updated_at)
         values (?, ?, 'running', ?, ?, ?, ?)`,
      )
      .run(JSON.stringify(scope), JSON.stringify(rules), total, this.source, at, at);
    const job = this.get(Number(lastInsertRowid));
    if (!job) throw new Error('scrape job not created');
    return job;
  }

  /** The newest running or paused job, if any (resumed at launch). */
  active(): Job<R> | null {
    const row = this.db.$client
      .prepare(
        `select ${COLUMNS} from scrape_jobs where status in ('running', 'paused')
         and source = ? order by id desc limit 1`,
      )
      .get(this.source) as Row | undefined;
    return row ? this.parse(row) : null;
  }

  save(job: Job<R>, now: Date): void {
    this.db.$client
      .prepare(
        `update scrape_jobs set status = @status, cursor_game_id = @cursorGameId, done = @done,
           applied = @applied, review = @review, not_found = @notFound, failed = @failed,
           launchbox = @launchbox, paused_reason = @pausedReason, resume_at = @resumeAt, updated_at = @updatedAt
         where id = @id`,
      )
      .run({
        id: job.id,
        status: job.status,
        cursorGameId: job.cursorGameId,
        done: job.done,
        applied: job.applied,
        review: job.review,
        notFound: job.notFound,
        failed: job.failed,
        launchbox: job.launchbox,
        pausedReason: job.pausedReason,
        resumeAt: job.resumeAt,
        updatedAt: now.toISOString(),
      });
  }

  private get(id: number): Job<R> | null {
    const row = this.db.$client
      .prepare(`select ${COLUMNS} from scrape_jobs where id = ?`)
      .get(id) as Row | undefined;
    return row ? this.parse(row) : null;
  }

  private parse(row: Row): Job<R> {
    return {
      ...row,
      scope: BatchScopeSchema.parse(JSON.parse(row.scope)),
      rules: this.parseRules(JSON.parse(row.rules)),
    };
  }
}
