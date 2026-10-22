// Ported from NextLevelOS src/themes/engine/types.ts @ 3d530b7: menu items are MenuNodes, games
// are ThemeGames identified by id, and keymaps go from input actions (not keys) to intents.
import type { GameBackgroundSource, InputAction, MenuNode, ThemeGame } from '@nextlevel/shared';
import type { ComponentType, ReactNode } from 'react';

/** One screen in the drill-down. `stack[0]` is always a root menu level. */
export type Level =
  | {
      kind: 'menu';
      /** The node that was entered to reach this level; null = root. */
      node: MenuNode | null;
      items: MenuNode[];
      title: string;
      /** The focus this level had when the user last left it. */
      lastFocusIndex: number;
    }
  | {
      kind: 'games';
      node: MenuNode;
      /** Nearest ancestor-or-self system; null for a collection. */
      systemId: string | null;
      /** Present when the level came from a filter node. */
      filter?: string;
      /** On a level entered with `{ flattenFilters: true }`: the node's filter children, as tabs. */
      filterTabs?: MenuNode[];
      /** With `filterTabs`: the filter of the tab in use, kept across a theme switch. */
      filterTab?: string;
      games: ThemeGame[];
      loading: boolean;
      error?: string;
      lastFocusIndex: number;
    };

export interface EnterOptions {
  /** Open a node whose children are all filter nodes as one games level with `filterTabs`. */
  flattenFilters?: boolean;
}

export interface EngineState {
  stack: Level[];
  focusIndex: number;
  status: 'loading' | 'ready' | 'error';
  error?: string;
}

export type NavAction =
  | { type: 'menu-loaded'; items: MenuNode[]; title: string }
  | { type: 'menu-failed'; error: string }
  | { type: 'push'; level: Level }
  | { type: 'select-root'; index: number; level: Level }
  | { type: 'back' }
  | { type: 'home' }
  | { type: 'set-focus'; index: number }
  | { type: 'patch-games'; games: ThemeGame[] }
  | { type: 'patch-game'; gameId: number; patch: Partial<ThemeGame> }
  | { type: 'patch-games-error'; error: string }
  | { type: 'replace-stack'; stack: Level[]; focusIndex: number }
  | { type: 'set-filter-tab'; filterTab?: string | undefined };

export type BackgroundLayer =
  { kind: 'image'; candidates: string[] } | { kind: 'video'; candidates: string[] };

/** How a theme sources art; the merged result of module, pack and user options. */
export interface ThemeArtConfig {
  logoVariant: string;
  backgroundVariants: string[];
  useVideoBackground: boolean;
  /** Games-level background priority; omitted → fanart, video, screenshot. */
  gameBackgroundSources?: GameBackgroundSource[];
  /** Slow zoom on still full-screen backgrounds; omitted → true. */
  backgroundZoom?: boolean;
  /** Game tile art kinds per system id or `default`. */
  gameArt?: Record<string, string[]>;
}

export type NavIntent =
  | { kind: 'focus-prev' }
  | { kind: 'focus-next' }
  | { kind: 'focus-up' }
  | { kind: 'focus-down' }
  | { kind: 'enter' }
  | { kind: 'back' }
  | { kind: 'home' }
  | { kind: 'toggle-search' }
  | { kind: 'tab-prev' }
  | { kind: 'tab-next' }
  | { kind: 'toggle-favorite' }
  | { kind: 'toggle-hidden' }
  | { kind: 'show-help' }
  | { kind: 'open-menu' }
  | { kind: 'jump-prev' }
  | { kind: 'jump-next' }
  | { kind: 'random' };

export type NavIntentKind = NavIntent['kind'];

/** A theme's bindings: which intent each input action means in this theme. */
export type KeyMap = Partial<Record<InputAction, NavIntentKind>>;

/**
 * Props every theme Component receives. Its key-listening root is its outermost element with
 * `tabIndex={0}`.
 */
export interface ThemeComponentProps {
  onExit: () => void;
  /** False while a host overlay owns the input. Default true. */
  inputEnabled?: boolean;
}

/** Free-form per-theme options (e.g. HyperSpin's `wheel`); each theme validates its own keys. */
export type ThemeSettings = Record<string, unknown>;

export interface ThemeModule {
  id: string;
  /** i18n keys for the theme's name and description. */
  nameKey: string;
  descriptionKey?: string;
  art: ThemeArtConfig;
  /** Code defaults for this theme's settings. */
  settings?: ThemeSettings;
  /** Which intent each input action means in this theme (key help, gamepad reachability). */
  keymap: KeyMap;
  Component: ComponentType<ThemeComponentProps>;
}

export type CarouselRenderItem<T> = (args: {
  item: T;
  index: number;
  focused: boolean;
  /** Signed distance from the centered item. */
  offset: number;
}) => ReactNode;
