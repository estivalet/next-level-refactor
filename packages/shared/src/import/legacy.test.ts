import { describe, expect, it } from 'vitest';
import {
  LegacyConfigSchema,
  LegacyGameSchema,
  LegacyGamelistSchema,
  LegacyLaunchersSchema,
  LegacyMenuSchema,
  LegacyScreenscraperSchema,
  LegacyThemesSchema,
} from './legacy.ts';

describe('NextLevelOS legacy file schemas', () => {
  it('FR-IMP-1: played is a string, a number or null', () => {
    for (const played of ['20', 3, null]) {
      expect(LegacyGameSchema.parse({ filename: './a.zip', played }).played).toBe(played);
    }
  });

  it('FR-IMP-1: a field of the wrong type is dropped, not fatal', () => {
    const game = LegacyGameSchema.parse({ filename: './a.zip', year: { bad: 1 }, hidden: 'yes' });
    expect(game.year).toBeUndefined();
    expect(game.hidden).toBeUndefined();
  });

  it('FR-IMP-1: a game needs a file name', () => {
    expect(LegacyGameSchema.safeParse({ title: 'No file' }).success).toBe(false);
  });

  it('FR-IMP-1: a gamelist without games fails (the caller reports notAGamelist)', () => {
    expect(LegacyGamelistSchema.safeParse({ gamelist: 'x', total: 3 }).success).toBe(false);
    expect(LegacyGamelistSchema.safeParse({ games: [{ title: 'kept raw' }] }).success).toBe(true);
  });

  it('FR-IMP-1: romext and rompath may be a string or a list', () => {
    const launchers = LegacyLaunchersSchema.parse({
      A: { command: 'x', rompath: 'p', romext: 'zip' },
      B: { command: 'y', rompath: ['q'], romext: ['7z', 'ZIP'] },
    });
    expect(launchers['A']).toMatchObject({ rompath: ['p'], romext: ['zip'] });
    expect(launchers['B']).toMatchObject({ rompath: ['q'], romext: ['7z', 'ZIP'] });
  });

  it('FR-IMP-1: unknown keys are kept for the report', () => {
    const config = LegacyConfigSchema.parse({ storage: [], 'squashfs.exe': 'C:/x.exe' });
    expect(config['squashfs.exe']).toBe('C:/x.exe');
    const game = LegacyGameSchema.parse({ filename: './a', ai_updated: true });
    expect(game['ai_updated']).toBe(true);
  });

  it('FR-IMP-1: menu items keep the disply typo, missing type and nested items', () => {
    const menu = LegacyMenuSchema.parse({
      title: 'Main',
      items: [{ name: 'C', items: [{ name: 'Q', disply: 'Q!', type: 'collection' }] }],
    });
    expect(menu.items[0]?.type).toBeUndefined();
    expect(menu.items[0]?.items?.[0]).toMatchObject({ disply: 'Q!', type: 'collection' });
  });

  it('FR-IMP-1: storage entries need a path; priority may be missing', () => {
    const config = LegacyConfigSchema.parse({
      storage: [{ name: 'A', path: 'e:/x' }, { name: 'B' }],
    });
    expect(config.storage).toEqual([{ name: 'A', path: 'e:/x' }]);
  });

  it('FR-IMP-1: themes and screenscraper ids parse leniently', () => {
    const themes = LegacyThemesSchema.parse({
      activeDefault: 'big-box',
      themes: [{ id: 'big-box', art: { gameArt: { 'Nintendo 64': ['box-front'] } } }, { no: 1 }],
    });
    expect(themes.themes).toHaveLength(1);
    expect(LegacyScreenscraperSchema.parse({ A: 26, B: 'x' })).toEqual({ A: 26 });
  });
});
