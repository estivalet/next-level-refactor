// Ported from NextLevelOS src/themes/components/useGamesLevelController.ts @ 3d530b7: games are
// ThemeGames, messages go through i18n, and a failed launch shows its reason.
import type { ThemeGame } from '@nextlevel/shared';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { isFavorite, isHidden } from '../engine/gameFlags.ts';
import { moveInGrid, type GridDir } from '../engine/gridMath.ts';
import type { NavIntentKind } from '../engine/types.ts';
import { useThemeNavigation } from '../engine/useThemeNavigation.ts';
import type { GameTab } from './gameTabs.ts';
import { useTabbedGames } from './useTabbedGames.ts';

/** Stable empty list for menu levels (keeps memo dependencies steady). */
const NO_GAMES: readonly ThemeGame[] = [];

const GRID_DIRS: Partial<Record<NavIntentKind, GridDir>> = {
  'focus-prev': 'left',
  'focus-next': 'right',
  'focus-up': 'up',
  'focus-down': 'down',
};

const TOAST_MS = 2500;

/**
 * Everything a theme needs to drive a games level as a tabbed, searchable grid: tabs and focus
 * mapping, grid moves, launch, favorite/hidden with a failure toast, and a search input usable
 * from the keyboard. Presentation stays in the theme.
 */
export function useGamesLevelController({
  rootRef,
  columns,
  wrap = false,
  tabs,
  defaultTabId,
}: {
  rootRef: RefObject<HTMLElement | null>;
  columns: number;
  /** Left on the first game goes to the last, right on the last to the first. */
  wrap?: boolean;
  /** Tabs for this games level (default: All, Favorites, Hidden). */
  tabs?: readonly GameTab[] | undefined;
  defaultTabId?: string | undefined;
}) {
  const { t } = useTranslation();
  const nav = useThemeNavigation();
  const level = nav.currentLevel;
  const stackDepth = nav.state.stack.length;
  const isGamesLevel = level?.kind === 'games';
  const games = level?.kind === 'games' ? level.games : NO_GAMES;

  const tabbed = useTabbedGames({
    games,
    engineFocus: nav.state.focusIndex,
    setEngineFocus: nav.setFocus,
    resetKey: stackDepth,
    tabs,
    defaultTabId,
  });
  // Remember the filter tab in use so a theme switch lands on the same filter.
  const hasFilterTabs = level?.kind === 'games' && !!level.filterTabs;
  const activeFilter = tabbed.activeTabId.startsWith('filter:')
    ? tabbed.activeTabId.slice('filter:'.length)
    : undefined;
  const { setFilterTab } = nav;
  useEffect(() => {
    if (hasFilterTabs) setFilterTab(activeFilter);
  }, [hasFilterTabs, activeFilter, setFilterTab]);
  const { close: closeSearch, toggle: toggleSearch } = tabbed.search;
  useEffect(() => {
    closeSearch();
  }, [stackDepth, closeSearch]);

  // Theme input pauses only while the search input itself has focus; with the search open and
  // focus on the root, input drives the filtered list. (Removing a focused input fires no blur.)
  const [searchFocused, setSearchFocused] = useState(false);
  const searchOpen = tabbed.search.isOpen;
  useEffect(() => {
    if (!searchOpen) setSearchFocused(false);
  }, [searchOpen]);

  const focusedGame = isGamesLevel ? (tabbed.display[tabbed.displayFocus] ?? null) : null;

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
    },
    [],
  );
  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, TOAST_MS);
  }, []);

  const { updateGameFlags, launch } = nav;
  const toggleFlag = useCallback(
    async (flag: 'favorite' | 'hidden') => {
      if (!focusedGame) return;
      const patch =
        flag === 'favorite'
          ? { favorite: !isFavorite(focusedGame) }
          : { hidden: !isHidden(focusedGame) };
      const ok = await updateGameFlags(focusedGame, patch);
      if (!ok) showToast(t(`themes.toast.${flag}Failed`));
    },
    [focusedGame, updateGameFlags, showToast, t],
  );

  const play = useCallback(
    async (game: ThemeGame) => {
      const outcome = await launch(game);
      if (!outcome.ok && !outcome.reported) showToast(outcome.message);
    },
    [launch, showToast],
  );

  const handleIntent = (intent: NavIntentKind): boolean => {
    if (!isGamesLevel) return false;
    if (intent === 'back' && searchOpen) {
      // Back on the filtered list closes the search before leaving the level.
      closeSearch();
      return true;
    }
    const dir = GRID_DIRS[intent];
    if (dir) {
      const n = tabbed.display.length;
      if (n > 0) {
        const i = Math.max(0, tabbed.displayFocus);
        let next = moveInGrid(i, n, columns, dir);
        if (wrap && next === i) {
          if (dir === 'left' && i === 0) next = n - 1;
          else if (dir === 'right' && i === n - 1) next = 0;
        }
        tabbed.setDisplayFocus(next);
      }
      return true;
    }
    switch (intent) {
      case 'enter':
        if (focusedGame) void play(focusedGame);
        return true;
      case 'tab-prev':
        tabbed.cycleTab(-1);
        return true;
      case 'tab-next':
        tabbed.cycleTab(1);
        return true;
      case 'toggle-favorite':
        void toggleFlag('favorite');
        return true;
      case 'toggle-hidden':
        void toggleFlag('hidden');
        return true;
      default:
        return false;
    }
  };

  const onToggleSearch = useCallback(() => {
    if (isGamesLevel) toggleSearch();
  }, [isGamesLevel, toggleSearch]);

  const searchInputProps = {
    value: tabbed.search.query,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      tabbed.search.setQuery(event.target.value);
    },
    onFocus: () => {
      setSearchFocused(true);
    },
    onBlur: () => {
      setSearchFocused(false);
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        tabbed.search.close();
        rootRef.current?.focus();
      } else if (event.key === 'Enter' || event.key === 'ArrowDown') {
        // Keep the query and hand input to the filtered list.
        event.preventDefault();
        rootRef.current?.focus();
      }
    },
  };

  return {
    games,
    isGamesLevel,
    tabbed,
    focusedGame,
    handleIntent,
    play,
    onToggleSearch,
    searchFocused,
    searchInputProps,
    toast,
    showToast,
  };
}
