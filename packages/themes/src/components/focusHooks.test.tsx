// Cases ported from NextLevelOS src/themes/components/useSettledFocus.test.tsx,
// useThemeRootFocus.test.tsx and useTabbedGames.test.tsx @ 3d530b7 (games are ThemeGames).
import type { ThemeGame } from '@nextlevel/shared';
import { act, render, renderHook, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_GAMES } from '../host/fixtures.ts';
import { useSettledFocus } from './useSettledFocus.ts';
import { useTabbedGames } from './useTabbedGames.ts';
import { useThemeRootFocus } from './useThemeRootFocus.ts';
import { buildFilterTabs } from './gameTabs.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('useSettledFocus (FR-THM-1)', () => {
  it('returns the initial key immediately', () => {
    const { result } = renderHook(() => useSettledFocus('a', 250));
    expect(result.current).toBe('a');
  });

  it('holds the old key until the delay passes, settling only on the last change', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ k }) => useSettledFocus(k, 250), {
      initialProps: { k: 'a' },
    });
    rerender({ k: 'b' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ k: 'c' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(result.current).toBe('c');
  });

  it('returns the new key immediately when resetKey changes', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ k, r }) => useSettledFocus(k, 250, r), {
      initialProps: { k: 'a', r: 'L1' },
    });
    rerender({ k: 'b', r: 'L2' });
    expect(result.current).toBe('b');
  });

  it('clears its timer on unmount', () => {
    vi.useFakeTimers();
    const { rerender, unmount } = renderHook(({ k }) => useSettledFocus(k, 250), {
      initialProps: { k: 'a' },
    });
    rerender({ k: 'b' });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

function RootProbe({ enabled }: { enabled?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useThemeRootFocus(rootRef, { status: 'ready', stackDepth: 1, enabled: enabled ?? true });
  return (
    <>
      <div ref={rootRef} tabIndex={0} data-testid="root" />
      <textarea data-testid="outside" />
    </>
  );
}

const windowRegainsFocus = () => {
  act(() => {
    window.dispatchEvent(new Event('focus'));
  });
};

describe('useThemeRootFocus (FR-THM-3)', () => {
  it('focuses the theme root on mount', () => {
    render(<RootProbe />);
    expect(document.activeElement).toBe(screen.getByTestId('root'));
  });

  it('pulls focus back to the theme root when the window regains focus', () => {
    render(<RootProbe />);
    screen.getByTestId('outside').focus();
    windowRegainsFocus();
    expect(document.activeElement).toBe(screen.getByTestId('root'));
  });

  it('leaves focus alone while the theme is disabled (e.g. behind the desktop)', () => {
    render(<RootProbe enabled={false} />);
    const outside = screen.getByTestId('outside');
    outside.focus();
    windowRegainsFocus();
    expect(document.activeElement).toBe(outside);
  });
});

const base = FIXTURE_GAMES[0] as ThemeGame;
const mk = (id: number, over: Partial<ThemeGame> = {}): ThemeGame => ({ ...base, id, ...over });

function setupTabs(initialGames: ThemeGame[], initialFocus = 0) {
  return renderHook(
    ({ games, resetKey }: { games: ThemeGame[]; resetKey: number }) => {
      const [focus, setFocus] = useState(initialFocus);
      const tabbed = useTabbedGames({
        games,
        engineFocus: focus,
        setEngineFocus: setFocus,
        resetKey,
      });
      return { ...tabbed, focus };
    },
    { initialProps: { games: initialGames, resetKey: 0 } },
  );
}

const shown = (games: readonly ThemeGame[]) => games.map((g) => g.id);

describe('useTabbedGames (FR-THM-1)', () => {
  it('defaultTabId picks the opening tab; a game outside it falls back to its own tab', () => {
    const filters = buildFilterTabs([
      {
        id: 'f:h',
        name: 'S',
        display: 'Homebrew',
        type: 'filter',
        filter: 'homebrew',
        children: [],
      },
      {
        id: 'f:o',
        name: 'S',
        display: 'Official',
        type: 'filter',
        filter: 'official',
        children: [],
      },
    ]);
    const games = [mk(1, { filters: ['official'] }), mk(2, { filters: ['homebrew'] })];
    const run = (focus: number, list: ThemeGame[]) =>
      renderHook(() => {
        const [f, setF] = useState(focus);
        return useTabbedGames({
          games: list,
          engineFocus: f,
          setEngineFocus: setF,
          tabs: filters.tabs,
          defaultTabId: filters.defaultTabId,
        });
      }).result;
    expect(run(0, games).current.activeTabId).toBe('filter:official');
    expect(run(0, []).current.activeTabId).toBe('filter:official');
    expect(run(1, games).current.activeTabId).toBe('filter:homebrew');
  });

  it('starts on All, excludes hidden, counts tabs', () => {
    const { result } = setupTabs([mk(1), mk(2, { hidden: true }), mk(3)]);
    expect(result.current.activeTabId).toBe('all');
    expect(shown(result.current.display)).toEqual([1, 3]);
    expect(result.current.counts).toEqual({ all: 2, favorites: 0, hidden: 1 });
  });

  it('starts on the Hidden tab when the engine-focused game is hidden', () => {
    const { result } = setupTabs([mk(1), mk(2, { hidden: true })], 1);
    expect(result.current.activeTabId).toBe('hidden');
    expect(result.current.displayFocus).toBe(0);
  });

  it('setDisplayFocus maps to the unfiltered engine index', () => {
    const { result } = setupTabs([mk(1), mk(2, { hidden: true }), mk(3)]);
    act(() => {
      result.current.setDisplayFocus(1);
    });
    expect(result.current.focus).toBe(2);
    expect(result.current.displayFocus).toBe(1);
  });

  it('hiding the focused game moves focus to the game now at the same position', () => {
    const games = [mk(1), mk(2), mk(3)];
    const { result, rerender } = setupTabs(games, 1);
    rerender({ games: [mk(1), mk(2, { hidden: true }), mk(3)], resetKey: 0 });
    expect(shown(result.current.display)).toEqual([1, 3]);
    expect(result.current.focus).toBe(2);
  });

  it('cycleTab wraps from the first tab to the last', () => {
    const { result } = setupTabs([mk(1), mk(2)], 1);
    act(() => {
      result.current.cycleTab(-1);
    });
    expect(result.current.activeTabId).toBe('hidden');
    act(() => {
      result.current.cycleTab(1);
    });
    expect(result.current.activeTabId).toBe('all');
  });

  it('selectTab moves to the first game when the focused one is not in the new tab', () => {
    const { result } = setupTabs([mk(1), mk(2, { favorite: true }), mk(3, { favorite: true })]);
    act(() => {
      result.current.selectTab('favorites');
    });
    expect(shown(result.current.display)).toEqual([2, 3]);
    expect(result.current.focus).toBe(1);
  });

  it('an empty tab leaves focus untouched', () => {
    const { result } = setupTabs([mk(1), mk(2)], 1);
    act(() => {
      result.current.selectTab('hidden');
    });
    expect(result.current.display).toEqual([]);
    expect(result.current.displayFocus).toBe(-1);
    expect(result.current.focus).toBe(1);
  });

  it('a resetKey change returns to the initial tab', () => {
    const games = [mk(1), mk(2)];
    const { result, rerender } = setupTabs(games);
    act(() => {
      result.current.selectTab('hidden');
    });
    rerender({ games, resetKey: 1 });
    expect(result.current.activeTabId).toBe('all');
  });
});
