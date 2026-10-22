import type { ThemeGame } from '@nextlevel/shared';
import { createContext, useContext } from 'react';
import type { BackgroundLayer, ThemeArtConfig } from './types.ts';

/** The art a theme can show: URLs of files that exist, never guesses (FR-THM-2, ADR-010). */
export interface ThemeArtApi {
  /** False until the art index has loaded (or failed). */
  ready: boolean;
  config: ThemeArtConfig;
  /** Whether the shared art folder backs up the pack. */
  fallback: boolean;
  warnings: string[];
  /** URLs for relative art paths, pack first. */
  urls: (rels: string[]) => string[];
  logo: (name: string) => string[];
  menuBackgroundLayers: (name: string) => BackgroundLayer[];
  /** The focused game's background; `systemName` picks the system wallpaper fallback. */
  gameBackgroundLayers: (game: ThemeGame, systemName: string) => BackgroundLayer[];
  gameMedia: (game: ThemeGame, kind: string) => string | null;
  /** Tile art for a game, per `art.gameArt` for its system, then the defaults. */
  gameTile: (game: ThemeGame) => string[];
  pointer: (name: string) => string[];
  sound: (name: string) => string[];
  hardware: (name: string) => string[];
  systemInfo: (name: string) => string[];
}

export const DEFAULT_ART_CONFIG: ThemeArtConfig = {
  logoVariant: 'clear',
  backgroundVariants: ['background/artwork', 'background/photo'],
  useVideoBackground: true,
};

/** Game tile kinds when a theme's `gameArt` names none for the system. */
export const DEFAULT_TILE_KINDS = [
  'box-front',
  'screenshot-title',
  'screenshot-game-play',
  'logo-clear',
];

const none = () => [];

/** Without a provider there is no art: themes show their text fallbacks. */
export const NO_ART: ThemeArtApi = {
  ready: true,
  config: DEFAULT_ART_CONFIG,
  fallback: true,
  warnings: [],
  urls: none,
  logo: none,
  menuBackgroundLayers: none,
  gameBackgroundLayers: none,
  gameMedia: () => null,
  gameTile: none,
  pointer: none,
  sound: none,
  hardware: none,
  systemInfo: none,
};

export const ThemeArtContext = createContext<ThemeArtApi>(NO_ART);

export function useThemeArt(): ThemeArtApi {
  return useContext(ThemeArtContext);
}
