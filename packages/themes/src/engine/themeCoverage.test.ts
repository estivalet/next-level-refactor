// Cases ported from NextLevelOS src/themes/engine/themeCoverage.test.ts @ 3d530b7.
import { describe, expect, it } from 'vitest';
import { collectMenuNames, computeCoverage } from './themeCoverage.ts';
import { category, filterNode, systemNode } from './testNodes.ts';
import type { ThemeArtConfig } from './types.ts';

const art: ThemeArtConfig = {
  logoVariant: 'clear',
  backgroundVariants: ['background-theme-shot', 'background'],
  useVideoBackground: true,
};

describe('collectMenuNames (FR-THM-2)', () => {
  it('walks the tree depth-first and de-duplicates by name', () => {
    const names = collectMenuNames([
      category('Arcade', [
        category('Arcade'),
        systemNode('neogeo', 'SNK Neo Geo', [filterNode('neogeo', 'SNK Neo Geo', 'official')]),
      ]),
      category('Consoles', [systemNode('snes', 'SNES')]),
    ]);
    expect(names).toEqual(['Arcade', 'SNK Neo Geo', 'Consoles', 'SNES']);
  });
});

describe('computeCoverage (FR-THM-2)', () => {
  const names = ['Arcade', 'SNES'];

  it('counts each slot and lists what is missing', () => {
    const cov = computeCoverage(names, art, [
      'logo/clear/Arcade.png',
      'logo/clear/SNES.png',
      'background/SNES.png',
      'video/Arcade.mp4',
    ]);
    expect(cov.slots.logo).toEqual({ have: 2, total: 2, missing: [] });
    expect(cov.slots.background).toEqual({ have: 1, total: 2, missing: ['Arcade'] });
    expect(cov.slots.video).toEqual({ have: 1, total: 2, missing: ['SNES'] });
    expect(cov.percent).toBe(67); // 4 of 6
  });

  it('matches file names case-insensitively, like Windows does', () => {
    const cov = computeCoverage(['Super Nintendo'], art, [
      'LOGO/Clear/super nintendo.PNG',
      'Background-Theme-Shot/SUPER NINTENDO.jpg',
    ]);
    expect(cov.slots.logo.have).toBe(1);
    expect(cov.slots.background.have).toBe(1);
  });

  it('accepts backslash separators in pack paths', () => {
    const cov = computeCoverage(['SNES'], art, ['logo\\clear\\SNES.png']);
    expect(cov.slots.logo.have).toBe(1);
  });

  it('skips the video slot when video backgrounds are off', () => {
    const cov = computeCoverage(names, { ...art, useVideoBackground: false }, [
      'logo/clear/Arcade.png',
      'logo/clear/SNES.png',
    ]);
    expect(cov.slots.video).toEqual({ have: 0, total: 0, missing: [] });
    expect(cov.percent).toBe(50); // 2 of 4
  });

  it('only counts the configured logo variant and background variants', () => {
    const cov = computeCoverage(['SNES'], art, [
      'logo/steel/SNES.png',
      'background-other/SNES.jpg',
    ]);
    expect(cov.slots.logo.have).toBe(0);
    expect(cov.slots.background.have).toBe(0);
  });

  it('is 0% with nothing to count', () => {
    expect(computeCoverage([], art, []).percent).toBe(0);
  });
});

describe('computeCoverage with nested background variants', () => {
  it('counts files under background/<style>/', () => {
    const nested = { ...art, backgroundVariants: ['background/artwork', 'background/photo'] };
    const cov = computeCoverage(['SNES', 'Arcade'], nested, ['background/photo/SNES.png']);
    expect(cov.slots.background).toEqual({ have: 1, total: 2, missing: ['Arcade'] });
  });
});

describe('computeCoverage wallpaper slot', () => {
  it('counts background/wallpaper but leaves it out of the percent', () => {
    const cov = computeCoverage(['SNES', 'Arcade'], { ...art, useVideoBackground: false }, [
      'logo/clear/SNES.png',
      'logo/clear/Arcade.png',
      'background-theme-shot/SNES.jpg',
      'background-theme-shot/Arcade.png',
      'background/wallpaper/SNES.png',
    ]);
    expect(cov.slots.wallpaper).toEqual({ have: 1, total: 2, missing: ['Arcade'] });
    expect(cov.percent).toBe(100);
  });
});
