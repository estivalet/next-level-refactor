import { describe, expect, it } from 'vitest';
import {
  BatchItemsInputSchema,
  BatchJobItemSchema,
  BatchRulesSchema,
  BatchScopeSchema,
  BatchStatusSchema,
  IDLE_BATCH,
} from './batch.ts';

describe('batch scrape contracts (FR-SCR-2, D18)', () => {
  it('rules: kinds and fields from the D16/D19 lists; title is never a batch field', () => {
    const rules = { onlyMissing: true, kinds: ['box-front'], fields: ['genre'], regions: ['us'] };
    expect(BatchRulesSchema.safeParse(rules).success).toBe(true);
    expect(BatchRulesSchema.safeParse({ ...rules, fields: ['title'] }).success).toBe(false);
    expect(BatchRulesSchema.safeParse({ ...rules, kinds: ['screenshot-select'] }).success).toBe(
      false,
    );
    expect(BatchRulesSchema.safeParse({ ...rules, regions: [] }).success).toBe(false);
  });

  it('scope: systems or up to 50,000 game ids', () => {
    expect(BatchScopeSchema.safeParse({ systemIds: ['snes'] }).success).toBe(true);
    expect(BatchScopeSchema.safeParse({ gameIds: [1, 2] }).success).toBe(true);
    expect(BatchScopeSchema.safeParse({ gameIds: [] }).success).toBe(false);
    expect(
      BatchScopeSchema.safeParse({ gameIds: Array.from({ length: 50_001 }, (_, i) => i + 1) })
        .success,
    ).toBe(false);
  });

  it('the idle status is valid', () => {
    expect(BatchStatusSchema.parse(IDLE_BATCH)).toEqual(IDLE_BATCH);
  });
});

describe('batch job details contracts (FR-SCR-8)', () => {
  it('FR-SCR-8: BatchItemsInput defaults limit to 100 and caps it at 200', () => {
    expect(BatchItemsInputSchema.parse({})).toEqual({ limit: 100 });
    expect(() => BatchItemsInputSchema.parse({ limit: 201 })).toThrow();
  });

  it('FR-SCR-8: a job item accepts skipped with no provider', () => {
    const item = {
      gameId: 1,
      title: 'A',
      systemId: 'switch',
      outcome: 'skipped',
      provider: null,
      error: null,
      handledAt: '2026-11-19T10:00:00.000Z',
    };
    expect(BatchJobItemSchema.parse(item)).toEqual(item);
  });

  it('FR-SCR-8: a status may carry startedAt and resumedAt', () => {
    const status = {
      ...IDLE_BATCH,
      startedAt: '2026-11-17T21:04:00.000Z',
      resumedAt: '2026-11-19T09:00:00.000Z',
    };
    expect(BatchStatusSchema.parse(status)).toEqual(status);
  });
});
