import type { BatchJobDetails, BatchStatus } from '@nextlevel/shared';
import type { Job } from './jobStore.ts';

/** The details panel's view of a job (FR-SCR-8): its status, scope, rules and listed games. */
export function jobDetails(job: Job, status: BatchStatus, listed: number): BatchJobDetails {
  return { status, scope: job.scope, rules: job.rules, startedAt: job.createdAt, listed };
}
