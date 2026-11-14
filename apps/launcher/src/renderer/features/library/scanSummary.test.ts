import type { ScanSummary } from '@nextlevel/shared';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { summaryLine } from './scanSummary.ts';

const t = ((key: string, options: { count?: number; list?: string }) =>
  `${key.split('.').pop() ?? key}:${options.list ?? String(options.count)}`) as unknown as TFunction;

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

  it('FR-LIB-3: the summary line ends with the storage locations not found', () => {
    const line = summaryLine(t, {
      ...summary(),
      missingLocations: [
        { name: 'Arcade drive', path: 'E:\\Roms' },
        { name: 'USB', path: 'F:\\' },
      ],
    });
    expect(line).toBe(
      'games:3 inSystems:1 · restored:3 · missing:1 · locationsMissing:Arcade drive (E:\\Roms), USB (F:\\)',
    );
  });
});
