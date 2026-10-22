// Ported from NextLevelOS src/themes/registry.test.ts @ 3d530b7 (themes.json and localStorage are
// gone: the launcher keeps the active theme in settings.themes).
import { THEME_ID } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { getTheme, resolveTheme, THEME_IDS, THEMES } from './registry.ts';

describe('theme registry (FR-THM-1)', () => {
  it('lists Big Box first, with unique valid ids', () => {
    expect(THEME_IDS[0]).toBe('big-box');
    expect(new Set(THEME_IDS).size).toBe(THEMES.length);
    for (const id of THEME_IDS) expect(id).toMatch(THEME_ID);
  });

  it('getTheme finds a theme by id, or nothing', () => {
    expect(getTheme('big-box')?.id).toBe('big-box');
    expect(getTheme('nope')).toBeUndefined();
  });

  it('FR-THM-5: resolveTheme falls back to Big Box for an unknown or missing id', () => {
    expect(resolveTheme('nope').id).toBe('big-box');
    expect(resolveTheme(null).id).toBe('big-box');
    expect(resolveTheme('big-box').id).toBe('big-box');
  });

  it('every theme names itself through i18n and binds a keymap', () => {
    for (const theme of THEMES) {
      expect(theme.nameKey).toMatch(/^themes\./);
      expect(Object.keys(theme.keymap).length).toBeGreaterThan(0);
    }
  });
});
