// Cases ported from NextLevelOS src/themes/engine/themePack.test.ts @ 3d530b7. Precedence follows
// data model §2.5: module defaults → pack theme.json → the user's Settings entry.
import { describe, expect, it } from 'vitest';
import { effectiveFallback, mergeThemeArt, mergeThemeSettings } from './themePack.ts';
import type { ThemeArtConfig } from './types.ts';

const moduleArt: ThemeArtConfig = {
  logoVariant: 'clear',
  backgroundVariants: ['m'],
  useVideoBackground: false,
};

describe('mergeThemeArt (FR-THM-2, FR-THM-4)', () => {
  it('applies module, then pack manifest, then user options, key by key', () => {
    const merged = mergeThemeArt(
      moduleArt,
      { backgroundVariants: ['p'], useVideoBackground: true },
      { backgroundVariants: ['u'] },
    );
    expect(merged).toEqual({
      logoVariant: 'clear',
      backgroundVariants: ['u'],
      useVideoBackground: true,
    });
  });

  it('returns the module art when nothing overrides it', () => {
    expect(mergeThemeArt(moduleArt)).toEqual(moduleArt);
  });
});

describe('mergeThemeSettings (FR-THM-4)', () => {
  it('merges objects under the same key, module then pack then user', () => {
    const merged = mergeThemeSettings(
      { wheel: { itemHeight: 80, spacing: 1 }, mode: 'a' },
      { wheel: { spacing: 0.8 } },
      { wheel: { focusScale: 1.5 }, mode: 'b' },
    );
    expect(merged).toEqual({ wheel: { itemHeight: 80, spacing: 0.8, focusScale: 1.5 }, mode: 'b' });
  });

  it('replaces non-object values instead of merging them', () => {
    expect(mergeThemeSettings({ wheel: { a: 1 } }, { wheel: 'off' })).toEqual({ wheel: 'off' });
    expect(mergeThemeSettings({ list: [1, 2] }, undefined, { list: [3] })).toEqual({ list: [3] });
  });

  it('is empty with no sources and never mutates its inputs', () => {
    expect(mergeThemeSettings()).toEqual({});
    const mod = { wheel: { a: 1 } };
    mergeThemeSettings(mod, { wheel: { b: 2 } });
    expect(mod).toEqual({ wheel: { a: 1 } });
  });
});

describe('effectiveFallback (FR-THM-2)', () => {
  it('is the manifest fallback, true when absent; a preview forces it off', () => {
    expect(effectiveFallback(null)).toBe(true);
    expect(effectiveFallback({ id: 'x', fallback: false })).toBe(false);
    expect(effectiveFallback({ id: 'x' }, { preview: true })).toBe(false);
  });
});
