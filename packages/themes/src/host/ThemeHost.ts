import type {
  ArtIndex,
  ArtRoot,
  InputSettings,
  MenuTree,
  ThemeGame,
  ThemeOptions,
} from '@nextlevel/shared';

/** Something outside the theme changed (FR-THM-6). */
export type HostEvent =
  | { type: 'library-changed'; gameIds?: number[] }
  | { type: 'launch-finished'; gameId: number; ok: boolean }
  | { type: 'settings-changed' };

export type LaunchOutcome = { ok: true } | { ok: false; message: string };

/**
 * Everything a theme can reach outside itself (architecture §4.4, ADR-010). The launcher
 * implements it over IPC; the web player will implement it over HTTP. Themes never fetch data
 * files, call the bridge or probe the disk.
 */
export interface ThemeHost {
  getMenu(): Promise<MenuTree>;
  /** A whole level: every present game of a system, a system filter or a collection. */
  getGames(nodeId: string): Promise<ThemeGame[]>;
  getGameDetails(gameId: number): Promise<{ description: string | null }>;
  /** The pack and shared art files a theme may use, plus its pack manifest. */
  loadArtIndex(themeId: string): Promise<ArtIndex>;
  /** A URL for an indexed media kind of a game; null when the game has none of that kind. */
  mediaUrl(game: ThemeGame, kind: string): string | null;
  artUrl(root: ArtRoot, rel: string): string;
  launch(gameId: number): Promise<LaunchOutcome>;
  /** Persists favorite/hidden; false when it could not be saved. */
  setGameFlags(gameId: number, flags: { favorite?: boolean; hidden?: boolean }): Promise<boolean>;
  /** The user's option overrides for a theme (`settings.themes.entries[id]`). */
  themeOptions(themeId: string): ThemeOptions | undefined;
  input(): InputSettings;
  onEvent(listener: (event: HostEvent) => void): () => void;
}
