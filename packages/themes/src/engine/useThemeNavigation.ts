import type { MenuNode, ThemeGame } from '@nextlevel/shared';
import { createContext, useContext } from 'react';
import type { LaunchOutcome, ThemeHost } from '../host/ThemeHost.ts';
import type { GameFlagsPatch } from './gameFlags.ts';
import type { EngineState, EnterOptions, Level } from './types.ts';

/** What `useThemeNavigation()` gives a theme (ported from NextLevelOS EngineContextValue). */
export interface ThemeNavigation {
  state: EngineState;
  currentLevel: Level | null;
  focusedNode: MenuNode | null;
  focusedGame: ThemeGame | null;
  ancestors: MenuNode[];
  enter: (index: number, opts?: EnterOptions) => void;
  /** Replaces everything below the root with root item `index` (one step). */
  selectRoot: (index: number) => void;
  back: () => void;
  setFocus: (index: number) => void;
  home: () => void;
  launch: (game: ThemeGame) => Promise<LaunchOutcome>;
  /** Sets favorite/hidden at once, saves through the host, rolls back when that fails. */
  updateGameFlags: (game: ThemeGame, patch: GameFlagsPatch) => Promise<boolean>;
  retry: () => void;
  /** Each theme declares how it shows a system's filters (menu entries or game-list tabs). */
  setFilterLayout: (filtersInMenu: boolean) => void;
  /** Records the filter tab in use on a flattened games level. */
  setFilterTab: (filterTab: string | undefined) => void;
}

export const ThemeEngineContext = createContext<ThemeNavigation | null>(null);
export const ThemeHostContext = createContext<ThemeHost | null>(null);

export function useThemeNavigation(): ThemeNavigation {
  const navigation = useContext(ThemeEngineContext);
  if (!navigation) throw new Error('useThemeNavigation must be used within <ThemeEngineProvider>');
  return navigation;
}

/** The host the engine runs on, for themes that need details or media URLs. */
export function useThemeHost(): ThemeHost {
  const host = useContext(ThemeHostContext);
  if (!host) throw new Error('useThemeHost must be used within <ThemeEngineProvider>');
  return host;
}
