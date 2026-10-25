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

/** A `scrape_jobs` row in memory. */
export interface Job {
  id: number;
  scope: BatchScope;
  rules: BatchRules;
  status: JobState;
  cursorGameId: number | null;
  total: number;
  done: number;
  applied: number;
  review: number;
  notFound: number;
  failed: number;
  pausedReason: BatchPauseReason | null;
  resumeAt: string | null;
}

interface Row extends Omit<Job, 'scope' | 'rules'> {
  scope: string;
  rules: string;
}

const COLUMNS = `id, scope, rules, status, cursor_game_id as cursorGameId, total, done, applied,
  review, not_found as notFound, failed, paused_reason as pausedReason, resume_at as resumeAt`;

/** Batch jobs in `scrape_jobs` (FR-SCR-2): one row per job, saved after every game. */
export class JobStore {
  constructor(private readonly db: LibraryDb) {}

  create(scope: BatchScope, rules: BatchRules, total: number, now: Date): Job {
    const at = now.toISOString();
    const { lastInsertRowid } = this.db.$client
      .prepare(
        `insert into scrape_jobs (scope, rules, status, total, created_at, updated_at)
         values (?, ?, 'running', ?, ?, ?)`,
      )
      .run(JSON.stringify(scope), JSON.stringify(rules), total, at, at);
    const job = this.get(Number(lastInsertRowid));
    if (!job) throw new Error('scrape job not created');
    return job;
  }

  /** The newest running or paused job, if any (resumed at launch). */
  active(): Job | null {
    const row = this.db.$client
      .prepare(
        `select ${COLUMNS} from scrape_jobs where status in ('running', 'paused')
         order by id desc limit 1`,
      )
      .get() as Row | undefined;
    return row ? this.parse(row) : null;
  }

  save(job: Job, now: Date): void {
    this.db.$client
      .prepare(
        `update scrape_jobs set status = @status, cursor_game_id = @cursorGameId, done = @done,
           applied = @applied, review = @review, not_found = @notFound, failed = @failed,
           paused_reason = @pausedReason, resume_at = @resumeAt, updated_at = @updatedAt
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
        pausedReason: job.pausedReason,
        resumeAt: job.resumeAt,
        updatedAt: now.toISOString(),
      });
  }

  private get(id: number): Job | null {
    const row = this.db.$client
      .prepare(`select ${COLUMNS} from scrape_jobs where id = ?`)
      .get(id) as Row | undefined;
    return row ? this.parse(row) : null;
  }

  private parse(row: Row): Job {
    return {
      ...row,
      scope: BatchScopeSchema.parse(JSON.parse(row.scope)),
      rules: BatchRulesSchema.parse(JSON.parse(row.rules)),
    };
  }
}
