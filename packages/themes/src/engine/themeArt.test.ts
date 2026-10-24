// Cases ported from NextLevelOS src/themes/engine/themeArt.test.ts @ 3d530b7. Builders now return
// relative paths; createArtResolver keeps only files the art index has (pack before shared).
import type { ArtIndex } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import {
  backgroundImagePaths,
  buildGameBackgroundLayers,
  buildMenuBackgroundLayers,
  createArtResolver,
  hardwarePaths,
  logoPaths,
  pointerPaths,
  soundPaths,
  systemInfoPaths,
  videoPaths,
  wallpaperPaths,
} from './themeArt.ts';
import { game } from './testNodes.ts';
import type { ThemeArtConfig } from './types.ts';

const art: ThemeArtConfig = {
  logoVariant: 'clear',
  backgroundVariants: ['background/artwork', 'background/photo'],
  useVideoBackground: true,
};

const index = (packFiles: string[], assetsFiles: string[]): ArtIndex => ({
  packFiles,
  assetsFiles,
  manifest: null,
  warnings: [],
});

describe('art paths (FR-THM-2)', () => {
  it('builds the NextLevelOS folder layout for a menu name', () => {
    expect(logoPaths('Sega Saturn', art)).toEqual(['logo/clear/Sega Saturn.png']);
    expect(backgroundImagePaths('SNES', art)).toEqual([
      'background/artwork/SNES.jpg',
      'background/artwork/SNES.png',
      'background/photo/SNES.jpg',
      'background/photo/SNES.png',
    ]);
    expect(videoPaths('SNES', art)).toEqual(['video/SNES.mp4']);
    expect(videoPaths('SNES', { ...art, useVideoBackground: false })).toEqual([]);
    expect(wallpaperPaths('SNES')).toEqual([
      'background/wallpaper/SNES.jpg',
      'background/wallpaper/SNES.png',
    ]);
    expect(wallpaperPaths('')).toEqual([]);
    expect(pointerPaths('SNES')).toEqual(['pointer/SNES.png', 'pointer/_default.png']);
    expect(pointerPaths('')).toEqual(['pointer/_default.png']);
    expect(soundPaths('move-menu')).toEqual([
      'sound/move-menu.wav',
      'sound/move-menu.ogg',
      'sound/move-menu.mp3',
    ]);
    expect(hardwarePaths('SNES')).toEqual(['art/hardware/SNES.png']);
    expect(systemInfoPaths('SNES')).toEqual(['system-info/SNES.json']);
  });
});

describe('createArtResolver (FR-THM-2)', () => {
  it('keeps every pack hit before any shared hit, even at a lower-priority variant', () => {
    const resolver = createArtResolver(
      index(['background/photo/SNES.png'], ['background/artwork/SNES.jpg', 'logo/clear/SNES.png']),
      { themeId: 'big-box', fallback: true },
    );
    expect(resolver.resolve(backgroundImagePaths('SNES', art))).toEqual([
      { root: { kind: 'pack', themeId: 'big-box' }, rel: 'background/photo/SNES.png' },
      { root: { kind: 'assets' }, rel: 'background/artwork/SNES.jpg' },
    ]);
  });

  it('matches case-insensitively and returns the file as named on disk', () => {
    const resolver = createArtResolver(index([], ['LOGO/Clear/sega saturn.PNG']), {
      themeId: 'ps5',
      fallback: true,
    });
    expect(resolver.resolve(logoPaths('Sega Saturn', art))).toEqual([
      { root: { kind: 'assets' }, rel: 'LOGO/Clear/sega saturn.PNG' },
    ]);
  });

  it('drops the shared folder when fallback is off', () => {
    const resolver = createArtResolver(index([], ['logo/clear/SNES.png']), {
      themeId: 'ps5',
      fallback: false,
    });
    expect(resolver.resolve(logoPaths('SNES', art))).toEqual([]);
  });
});

describe('background layers', () => {
  const urls = (rels: string[]) => rels.map((rel) => `url:${rel}`);

  it('menu: wallpaper, then video, then the background variants; empty chains dropped', () => {
    expect(buildMenuBackgroundLayers('SNES', art, urls).map((layer) => layer.kind)).toEqual([
      'image',
      'video',
      'image',
    ]);
    const none = buildMenuBackgroundLayers('SNES', art, () => []);
    expect(none).toEqual([]);
    const noVideo = buildMenuBackgroundLayers('SNES', { ...art, useVideoBackground: false }, urls);
    expect(noVideo.map((layer) => layer.kind)).toEqual(['image', 'image']);
  });

  it('game: fanart → video → screenshots by default, then the wallpaper', () => {
    const media = (_g: unknown, kind: string) =>
      ['fanart', 'video', 'screenshot-game-title'].includes(kind) ? `m:${kind}` : null;
    const layers = buildGameBackgroundLayers(game(1), art, media, ['url:wall']);
    expect(layers).toEqual([
      { kind: 'image', candidates: ['m:fanart'] },
      { kind: 'video', candidates: ['m:video'] },
      { kind: 'image', candidates: ['m:screenshot-game-title'] },
      { kind: 'image', candidates: ['url:wall'] },
    ]);
  });

  it('game: honors a custom order, skips video when off and unlisted sources', () => {
    const media = (_g: unknown, kind: string) => `m:${kind}`;
    const layers = buildGameBackgroundLayers(
      game(1),
      { ...art, useVideoBackground: false, gameBackgroundSources: ['video', 'screenshot'] },
      media,
    );
    expect(layers).toEqual([
      {
        kind: 'image',
        candidates: ['m:screenshot-game-play', 'm:screenshot-game-title'],
      },
    ]);
  });
});
