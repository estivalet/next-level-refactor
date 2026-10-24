// Ported from NextLevelOS src/themes/registry.test.ts @ 3d530b7 (themes.json and localStorage are
// gone: the launcher keeps the active theme in settings.themes).
import { BUILT_IN_THEME_IDS, defaultSettings, THEME_ID } from '@nextlevel/shared';
import i18n from 'i18next';
import { describe, expect, it } from 'vitest';
import { getTheme, resolveTheme, THEME_IDS, THEMES } from './registry.ts';

describe('theme registry (FR-THM-1)', () => {
  it('FR-IMP-1: matches the built-in theme ids main knows (the importer checks them)', () => {
    expect([...THEME_IDS]).toEqual([...BUILT_IN_THEME_IDS]);
  });

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

  it('lists the six themes, Big Box first', () => {
    expect(THEME_IDS).toEqual([
      'big-box',
      'big-box-list',
      'console-home',
      'ps5',
      'hyperspin',
      'showcase',
    ]);
  });

  it('FR-THM-4: HyperSpin shows filters in the menu by default, with steel logos', () => {
    expect(getTheme('hyperspin')?.settings).toEqual({ filtersInMenu: true });
    expect(getTheme('hyperspin')?.art).toMatchObject({
      logoVariant: 'steel',
      useVideoBackground: true,
    });
  });

  it('FR-THM-4: Showcase shows filters as game-list tabs by default', () => {
    expect(getTheme('showcase')?.settings).toEqual({ filtersInMenu: false });
  });

  it('every theme name and description is translated', () => {
    for (const theme of THEMES) {
      expect(i18n.exists(theme.nameKey), theme.nameKey).toBe(true);
      if (theme.descriptionKey) expect(i18n.exists(theme.descriptionKey), theme.id).toBe(true);
    }
  });

  it('US-C1: every intent of every theme is reachable from a default gamepad button', () => {
    const pad = defaultSettings().input.gamepad;
    expect(pad.back.length).toBeGreaterThan(0);
    for (const theme of THEMES) {
      // Home has no default button (Guide stays unbound); back walks up to the root instead.
      const intents = new Set(Object.values(theme.keymap).filter((i) => i !== 'home'));
      for (const intent of intents) {
        const actions = Object.entries(theme.keymap)
          .filter(([, mapped]) => mapped === intent)
          .map(([action]) => action as keyof typeof pad);
        expect(
          actions.some((action) => pad[action].length > 0),
          `${theme.id}: ${intent}`,
        ).toBe(true);
      }
    }
  });
});
