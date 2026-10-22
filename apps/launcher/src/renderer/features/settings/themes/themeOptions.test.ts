import { defaultSettings, type ArtIndex, type Settings } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import {
  artFolders,
  resetThemeOptions,
  setArtOption,
  setThemeSetting,
  setWheelOption,
} from './themeOptions.ts';

const base = (): Settings => defaultSettings();
const entry = (settings: Settings, id: string) => settings.themes.entries[id];

describe('theme option edits (FR-THM-4)', () => {
  it('sets an art option on the theme’s entry, creating it', () => {
    const next = setArtOption(base(), 'big-box', 'logoVariant', 'steel');
    expect(entry(next, 'big-box')).toEqual({ art: { logoVariant: 'steel' } });
  });

  it('clearing the last option removes the entry (the defaults apply again)', () => {
    const set = setArtOption(base(), 'big-box', 'backgroundZoom', false);
    expect(entry(setArtOption(set, 'big-box', 'backgroundZoom', undefined), 'big-box')).toBe(
      undefined,
    );
  });

  it('keeps the other options when one is cleared', () => {
    let s = setArtOption(base(), 'ps5', 'logoVariant', 'clear');
    s = setThemeSetting(s, 'ps5', 'filtersInMenu', true);
    s = setArtOption(s, 'ps5', 'logoVariant', undefined);
    expect(entry(s, 'ps5')).toEqual({ settings: { filtersInMenu: true } });
  });

  it('sets and clears wheel keys one by one', () => {
    let s = setWheelOption(base(), 'hyperspin', 'wheel', 'itemHeight', 80);
    s = setWheelOption(s, 'hyperspin', 'wheel', 'padding', [1, 2, 3, 4]);
    expect(entry(s, 'hyperspin')?.settings).toEqual({
      wheel: { itemHeight: 80, padding: [1, 2, 3, 4] },
    });
    s = setWheelOption(s, 'hyperspin', 'wheel', 'itemHeight', undefined);
    s = setWheelOption(s, 'hyperspin', 'wheel', 'padding', undefined);
    expect(entry(s, 'hyperspin')).toBeUndefined();
  });

  it('reset removes every option of that theme only', () => {
    let s = setArtOption(base(), 'ps5', 'logoVariant', 'x');
    s = setArtOption(s, 'big-box', 'logoVariant', 'y');
    s = resetThemeOptions(s, 'ps5');
    expect(Object.keys(s.themes.entries)).toEqual(['big-box']);
  });

  it('never changes the settings it was given', () => {
    const start = base();
    setArtOption(start, 'big-box', 'logoVariant', 'steel');
    expect(start.themes.entries).toEqual({});
  });
});

describe('art folders found in the index (FR-THM-4)', () => {
  const index: ArtIndex = {
    packFiles: ['logo/neon/A.png', 'background/poster/A.jpg'],
    assetsFiles: [
      'logo/clear/A.png',
      'logo/steel/B.png',
      'logo/clear/B.png',
      'background/artwork/A.jpg',
      'background/wallpaper/A.jpg',
      'video/A.mp4',
    ],
    manifest: null,
    warnings: [],
  };

  it('lists logo variants and background folders (not the wallpaper), sorted', () => {
    expect(artFolders(index)).toEqual({
      logoVariants: ['clear', 'neon', 'steel'],
      backgroundVariants: ['background/artwork', 'background/poster'],
    });
  });

  it('is empty without an index', () => {
    expect(artFolders(undefined)).toEqual({ logoVariants: [], backgroundVariants: [] });
  });
});
