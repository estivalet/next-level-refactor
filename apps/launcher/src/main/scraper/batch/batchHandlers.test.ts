import { IDLE_BATCH, ipcContract, type BatchRules } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { createBatchHandlers } from './batchHandlers.ts';

const RULES: BatchRules = { onlyMissing: true, kinds: ['box-front'], fields: [], regions: ['us'] };

describe('batch scrape channels (FR-SCR-2, US-C6)', () => {
  it('pass through to the service', async () => {
    const calls: unknown[] = [];
    const running = { ...IDLE_BATCH, jobId: 1, state: 'running' as const };
    const handlers = createBatchHandlers({
      batch: () => ({
        begin: (scope, rules) => {
          calls.push(['begin', scope, rules]);
          return Promise.resolve(running);
        },
        pause: () => {
          calls.push('pause');
          return running;
        },
        resume: () => Promise.resolve(running),
        cancel: () => running,
        status: () => IDLE_BATCH,
      }),
    });
    expect(
      await handlers['scraper.batch.start']({ scope: { systemIds: ['snes'] }, rules: RULES }),
    ).toBe(running);
    void handlers['scraper.batch.pause']();
    expect(calls).toEqual([['begin', { systemIds: ['snes'] }, RULES], 'pause']);
    expect(handlers['scraper.batch.status']()).toEqual(IDLE_BATCH);
  });

  it('the contract validates start', () => {
    const start = ipcContract['scraper.batch.start'].input;
    expect(start.safeParse({ scope: { systemIds: ['snes'] }, rules: RULES }).success).toBe(true);
    expect(start.safeParse({ scope: { gameIds: [] }, rules: RULES }).success).toBe(false);
  });
});
