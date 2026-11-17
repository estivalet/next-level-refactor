import type { SystemInfoSummary } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { homeCounts, recentlyChanged, withNotes } from './homeSelectors.ts';

const make = (
  systemId: string,
  changedAt: string | null = null,
  extra: Partial<SystemInfoSummary> = {},
): SystemInfoSummary => ({
  systemId,
  name: systemId,
  kind: 'console',
  manufacturer: null,
  releaseYear: null,
  edited: false,
  hasNotes: false,
  changedAt,
  ...extra,
});

describe('homeSelectors', () => {
  it('FR-MUS-9: recentlyChanged sorts desc, caps at 12, skips never-changed', () => {
    const rows = [
      make('never'),
      ...Array.from({ length: 14 }, (_, i) =>
        make(`s${String(i)}`, `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`),
      ),
    ];
    const out = recentlyChanged(rows);
    expect(out).toHaveLength(12);
    expect(out[0]?.systemId).toBe('s13');
    expect(out[11]?.systemId).toBe('s2');
    expect(out.some((row) => row.systemId === 'never')).toBe(false);
    expect(recentlyChanged(rows, 3)).toHaveLength(3);
  });

  it('FR-MUS-9: withNotes keeps the list order', () => {
    const rows = [
      make('a', null, { hasNotes: true }),
      make('b'),
      make('c', null, { hasNotes: true }),
    ];
    expect(withNotes(rows).map((row) => row.systemId)).toEqual(['a', 'c']);
  });

  it('FR-MUS-9: homeCounts totals systems, edited and with-notes', () => {
    const rows = [
      make('a', null, { edited: true }),
      make('b', null, { hasNotes: true }),
      make('c'),
    ];
    expect(homeCounts(rows)).toEqual({ systems: 3, edited: 1, notes: 1 });
  });
});
