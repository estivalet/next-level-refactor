import type { ScanSummary } from '@nextlevel/shared';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { summaryLine } from './scanSummary.ts';

const t = ((key: string, options: { count: number }) =>
  `${key.split('.').pop() ?? key}:${String(options.count)}`) as unknown as TFunction;

const summary = (addNew?: boolean): ScanSummary => ({
  scanId: 'scan-1',
  startedAt: '2026-10-31T00:00:00.000Z',
  finishedAt: '2026-10-31T00:01:00.000Z',
  outcome: 'completed',
  systems: [{ systemId: 'arcade', present: 3, added: 0, moved: 0, restored: 3, missing: 1 }],
  enabledSystemIds: [],
  ...(addNew === undefined ? {} : { addNew }),
});

describe('summaryLine', () => {
  it('a scan reports games found again', () => {
    expect(summaryLine(t, summary())).toBe('games:3 inSystems:1 · restored:3 · missing:1');
  });

  it("an import's scan doesn't call the games it just listed found again", () => {
    expect(summaryLine(t, summary(false))).toBe('games:3 inSystems:1 · missing:1');
  });
});
