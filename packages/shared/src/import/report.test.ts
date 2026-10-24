import { describe, expect, it } from 'vitest';
import en from '../i18n/en.json' with { type: 'json' };
import ptBR from '../i18n/pt-BR.json' with { type: 'json' };
import { IMPORT_REASONS, ImportReportSchema } from './report.ts';

const counts = {
  systems: 0,
  menus: 0,
  menuNodes: 0,
  gamelists: 0,
  games: 0,
  collections: 0,
  collectionEntries: 0,
};

describe('import report contract', () => {
  it('FR-IMP-2: a report carries counts, items and a token', () => {
    const report = ImportReportSchema.parse({
      source: 'C:/NextLevelOS/public/data',
      token: 'abc',
      counts,
      systems: [],
      mapped: [{ area: 'game', key: 'Arcade', reason: 'discSet', count: 2 }],
      unmapped: [{ area: 'system', key: 'X', reason: 'unknownSystem' }],
      willReplace: [],
    });
    expect(report.unmapped[0]?.reason).toBe('unknownSystem');
  });

  it('FR-IMP-2: an unknown reason is refused', () => {
    const item = { area: 'system', key: 'X', reason: 'whatever' };
    expect(
      ImportReportSchema.safeParse({
        source: 's',
        token: 't',
        counts,
        systems: [],
        mapped: [],
        unmapped: [item],
        willReplace: [],
      }).success,
    ).toBe(false);
  });

  it('FR-IMP-2: every reason has text in English and Portuguese', () => {
    const reasons = (dict: unknown) =>
      (dict as { import: { reason: Record<string, string> } }).import.reason;
    for (const code of IMPORT_REASONS) {
      expect(reasons(en)[code], code).toBeTruthy();
      expect(reasons(ptBR)[code], code).toBeTruthy();
    }
  });
});
