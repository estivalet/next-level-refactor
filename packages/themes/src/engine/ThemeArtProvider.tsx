import type { ArtIndex, ThemeGame } from '@nextlevel/shared';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ThemeHost } from '../host/ThemeHost.ts';
import {
  buildGameBackgroundLayers,
  buildMenuBackgroundLayers,
  createArtResolver,
  hardwarePaths,
  logoPaths,
  pointerPaths,
  soundPaths,
  systemInfoPaths,
  wallpaperPaths,
} from './themeArt.ts';
import { effectiveFallback, mergeThemeArt, mergeThemeSettings } from './themePack.ts';
import type { ThemeArtConfig, ThemeSettings } from './types.ts';
import { DEFAULT_TILE_KINDS, ThemeArtContext, type ThemeArtApi } from './useThemeArt.ts';
import { ThemeSettingsContext } from './useThemeSettings.ts';

const EMPTY_INDEX: ArtIndex = { packFiles: [], assetsFiles: [], manifest: null, warnings: [] };

/**
 * Supplies a theme's art and settings (FR-THM-2, FR-THM-4): loads its art index once, merges its
 * options (module → pack theme.json → the user's Settings entry, re-read on settings changes)
 * and turns relative art paths into URLs of files that exist.
 */
export function ThemeArtProvider({
  host,
  themeId,
  moduleArt,
  moduleSettings,
  preview = false,
  artRevision = 0,
  children,
}: {
  host: ThemeHost;
  themeId: string;
  moduleArt: ThemeArtConfig;
  moduleSettings?: ThemeSettings;
  /** "Preview without fallback": ignore the shared art folder this session. */
  preview?: boolean;
  /** Bumped after Rescan art in Settings: the index loads again. */
  artRevision?: number;
  children: ReactNode;
}) {
  const [index, setIndex] = useState<ArtIndex | null>(null);
  const [options, setOptions] = useState(() => host.themeOptions(themeId));

  // The index loads once, and again after a settings change (the art folders may have moved;
  // the host answers from its cache when they didn't).
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    host.loadArtIndex(themeId).then(
      (loaded) => {
        if (alive) setIndex(loaded);
      },
      () => {
        if (alive) setIndex(EMPTY_INDEX);
      },
    );
    return () => {
      alive = false;
    };
  }, [host, themeId, revision, artRevision]);

  useEffect(
    () =>
      host.onEvent((event) => {
        if (event.type !== 'settings-changed') return;
        setOptions(host.themeOptions(themeId));
        setRevision((n) => n + 1);
      }),
    [host, themeId],
  );

  const settings = useMemo(
    () => mergeThemeSettings(moduleSettings, index?.manifest?.settings, options?.settings),
    [moduleSettings, index, options],
  );

  const art = useMemo<ThemeArtApi>(() => {
    const manifest = index?.manifest ?? null;
    const config = mergeThemeArt(moduleArt, manifest?.art, options?.art);
    const fallback = effectiveFallback(manifest, { preview });
    const resolver = createArtResolver(index ?? EMPTY_INDEX, { themeId, fallback });
    const urls = (rels: string[]) =>
      resolver.resolve(rels).map((ref) => host.artUrl(ref.root, ref.rel));
    const gameMedia = (game: ThemeGame, kind: string) => host.mediaUrl(game, kind);
    return {
      ready: index !== null,
      config,
      fallback,
      warnings: index?.warnings ?? [],
      urls,
      logo: (name) => urls(logoPaths(name, config)),
      menuBackgroundLayers: (name) => buildMenuBackgroundLayers(name, config, urls),
      gameBackgroundLayers: (game, systemName) =>
        buildGameBackgroundLayers(game, config, gameMedia, urls(wallpaperPaths(systemName))),
      gameMedia,
      gameTile: (game) => {
        const kinds =
          config.gameArt?.[game.systemId] ?? config.gameArt?.['default'] ?? DEFAULT_TILE_KINDS;
        return kinds.flatMap((kind) => gameMedia(game, kind) ?? []);
      },
      pointer: (name) => urls(pointerPaths(name)),
      sound: (name) => urls(soundPaths(name)),
      hardware: (name) => urls(hardwarePaths(name)),
      systemInfo: (name) => urls(systemInfoPaths(name)),
    };
  }, [host, themeId, moduleArt, options, index, preview]);

  return (
    <ThemeArtContext.Provider value={art}>
      <ThemeSettingsContext.Provider value={settings}>{children}</ThemeSettingsContext.Provider>
    </ThemeArtContext.Provider>
  );
}
