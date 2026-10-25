// Ported from NextLevelOS src/themes/engine/themeArt.ts @ 3d530b7. Builders return paths relative
// to an art root; createArtResolver keeps the ones the art index has, every pack file before any
// shared file, so nothing probes the disk (ADR-010).
import type { ArtIndex, ArtRoot, GameBackgroundSource, ThemeGame } from '@nextlevel/shared';
import type { BackgroundLayer, ThemeArtConfig } from './types.ts';

/** Full-screen menu art that beats video, artwork and photo. */
export const WALLPAPER_FOLDER = 'background/wallpaper';
export const SOUND_EXTENSIONS = ['wav', 'ogg', 'mp3'] as const;
export const DEFAULT_GAME_BACKGROUND_SOURCES: GameBackgroundSource[] = [
  'fanart',
  'video',
  'screenshot',
];
/** Game media kinds tried, in order, for the `screenshot` background source. */
export const SCREENSHOT_KINDS = ['screenshot-game-play', 'screenshot-game-title'];

export const logoPaths = (name: string, art: ThemeArtConfig) => [
  `logo/${art.logoVariant}/${name}.png`,
];

/** jpg then png for each variant, in variant order. */
export const backgroundImagePaths = (name: string, art: ThemeArtConfig) =>
  art.backgroundVariants.flatMap((variant) => [`${variant}/${name}.jpg`, `${variant}/${name}.png`]);

export const videoPaths = (name: string, art: ThemeArtConfig) =>
  art.useVideoBackground ? [`video/${name}.mp4`] : [];

export const wallpaperPaths = (name: string) =>
  name ? [`${WALLPAPER_FOLDER}/${name}.jpg`, `${WALLPAPER_FOLDER}/${name}.png`] : [];

/** The name's pointer, then `_default`; an empty name tries only `_default`. */
export const pointerPaths = (name: string) => [
  ...(name ? [`pointer/${name}.png`] : []),
  'pointer/_default.png',
];

export const soundPaths = (name: string) => SOUND_EXTENSIONS.map((ext) => `sound/${name}.${ext}`);
export const hardwarePaths = (name: string) => [`art/hardware/${name}.png`];
export const systemInfoPaths = (name: string) => [`system-info/${name}.json`];

export interface ArtRef {
  root: ArtRoot;
  /** The path as named on disk. */
  rel: string;
}

export interface ArtResolver {
  /** The files that exist for `rels`: every pack hit (in `rels` order), then every shared hit. */
  resolve(rels: readonly string[]): ArtRef[];
}

/** Paths compare case-insensitively, as on Windows. */
const lookup = (files: readonly string[]) =>
  new Map(files.map((file) => [file.toLowerCase(), file]));

export function createArtResolver(
  index: ArtIndex,
  { themeId, fallback }: { themeId: string; fallback: boolean },
): ArtResolver {
  const pack = lookup(index.packFiles);
  const assets = fallback ? lookup(index.assetsFiles) : new Map<string, string>();
  const packRoot: ArtRoot = { kind: 'pack', themeId };
  const assetsRoot: ArtRoot = { kind: 'assets' };
  return {
    resolve(rels) {
      const hits = (files: Map<string, string>, root: ArtRoot) =>
        rels.flatMap((rel) => {
          const file = files.get(rel.toLowerCase());
          return file ? [{ root, rel: file }] : [];
        });
      return [...hits(pack, packRoot), ...hits(assets, assetsRoot)];
    },
  };
}

/**
 * A menu level's full-screen background: wallpaper, then the video (when enabled), then the
 * background variants. `urls` turns relative paths into URLs of existing files; empty layers
 * are dropped.
 */
export function buildMenuBackgroundLayers(
  name: string,
  art: ThemeArtConfig,
  urls: (rels: string[]) => string[],
): BackgroundLayer[] {
  const layers: BackgroundLayer[] = [
    { kind: 'image', candidates: urls(wallpaperPaths(name)) },
    { kind: 'video', candidates: urls(videoPaths(name, art)) },
    { kind: 'image', candidates: urls(backgroundImagePaths(name, art)) },
  ];
  return layers.filter((layer) => layer.candidates.length > 0);
}

/**
 * The focused game's background, per `art.gameBackgroundSources` (default fanart → video →
 * screenshot; video only when enabled), then the system wallpaper. Only indexed media is used.
 */
export function buildGameBackgroundLayers(
  game: ThemeGame,
  art: ThemeArtConfig,
  mediaUrl: (game: ThemeGame, kind: string) => string | null,
  wallpaper: string[] = [],
): BackgroundLayer[] {
  const urls = (kinds: readonly string[]) =>
    kinds.flatMap((kind) => {
      const url = mediaUrl(game, kind);
      return url ? [url] : [];
    });
  const layers: BackgroundLayer[] = [];
  for (const source of art.gameBackgroundSources ?? DEFAULT_GAME_BACKGROUND_SOURCES) {
    if (source === 'video' && !art.useVideoBackground) continue;
    const candidates = urls(source === 'screenshot' ? SCREENSHOT_KINDS : [source]);
    if (candidates.length)
      layers.push({ kind: source === 'video' ? 'video' : 'image', candidates });
  }
  if (wallpaper.length) layers.push({ kind: 'image', candidates: wallpaper });
  return layers;
}
