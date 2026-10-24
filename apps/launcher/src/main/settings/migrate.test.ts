import { describe, expect, it } from 'vitest';
import { migrate } from './migrate.ts';

describe('migrate', () => {
  it('passes schemaVersion 2 through', () => {
    expect(migrate({ schemaVersion: 2, a: 1 })).toEqual({
      kind: 'ok',
      value: { schemaVersion: 2, a: 1 },
    });
  });

  it('treats an object without schemaVersion as version 1 and brings it to 2', () => {
    expect(migrate({ general: {} })).toEqual({
      kind: 'ok',
      value: { schemaVersion: 2, general: {} },
    });
  });

  it('v1 → v2 renames screenshot-title in themes.entries[*].art.gameArt (FR-SCR-4, D16)', () => {
    const v1 = {
      schemaVersion: 1,
      themes: {
        activeDefault: 'big-box',
        entries: {
          'big-box': {
            art: {
              gameArt: { all: ['screenshot-title', 'box-front'], snes: ['screenshot-select'] },
            },
            settings: { x: 1 },
          },
          showcase: { settings: { filtersInMenu: true } },
        },
      },
    };
    expect(migrate(v1)).toEqual({
      kind: 'ok',
      value: {
        schemaVersion: 2,
        themes: {
          activeDefault: 'big-box',
          entries: {
            'big-box': {
              art: { gameArt: { all: ['screenshot-game-title', 'box-front'] } },
              settings: { x: 1 },
            },
            showcase: { settings: { filtersInMenu: true } },
          },
        },
      },
    });
  });

  it('D16: no duplicates when a list already had the new name too', () => {
    const v1 = {
      schemaVersion: 1,
      themes: {
        entries: {
          ps5: {
            art: { gameArt: { n64: ['screenshot-game-title', 'screenshot-title', 'box-front'] } },
          },
        },
      },
    };
    const migrated = migrate(v1);
    expect(migrated).toMatchObject({
      value: {
        themes: {
          entries: { ps5: { art: { gameArt: { n64: ['screenshot-game-title', 'box-front'] } } } },
        },
      },
    });
  });

  it('leaves malformed theme entries for the schema to judge', () => {
    const v1 = { schemaVersion: 1, themes: { entries: { 'big-box': { art: { gameArt: 'x' } } } } };
    expect(migrate(v1)).toEqual({ kind: 'ok', value: { ...v1, schemaVersion: 2 } });
  });

  it('reports a file written by a newer version', () => {
    expect(migrate({ schemaVersion: 3 })).toEqual({ kind: 'newerVersion' });
  });

  it('leaves non-objects for the schema to reject', () => {
    expect(migrate(42)).toEqual({ kind: 'ok', value: 42 });
  });
});
