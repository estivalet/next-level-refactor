// useGameCount and GameDetailPanel read through the ThemeHost (FR-THM-6): counts come from a cached
// getGames per node, descriptions from getGameDetails once the focus settles.
import type { MenuNode, ThemeGame } from '@nextlevel/shared';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeHostContext } from '../engine/useThemeNavigation.ts';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { FIXTURE_GAMES, FIXTURE_MENU } from '../host/fixtures.ts';
import { GameDetailPanel, plainDescription } from './GameDetailPanel.tsx';
import { countLabel, useGameCount } from './useGameCount.ts';

const nintendo = FIXTURE_MENU.items[0] as MenuNode;
const snes = nintendo.children[0] as MenuNode;
const n64 = nintendo.children[1] as MenuNode;
const genesis = (FIXTURE_MENU.items[1] as MenuNode).children[0] as MenuNode;
const t = (key: string, opts?: Record<string, unknown>) => {
  const count = opts?.['count'];
  return `${key}:${typeof count === 'number' ? String(count) : ''}`;
};

function withHost(host: FakeThemeHost) {
  return ({ children }: { children: ReactNode }) => (
    <ThemeHostContext.Provider value={host}>{children}</ThemeHostContext.Provider>
  );
}

const getGamesCalls = (host: FakeThemeHost) =>
  host.calls.filter((call) => call.method === 'getGames').map((call) => call.args[0]);

describe('useGameCount (FR-THM-1, FR-THM-6)', () => {
  it('counts the children of a menu node at once', () => {
    const host = new FakeThemeHost();
    const { result } = renderHook(() => useGameCount(nintendo, 0), { wrapper: withHost(host) });
    expect(result.current).toEqual({ kind: 'items', count: 2 });
    expect(getGamesCalls(host)).toEqual([]);
  });

  it('loads the visible game count of a games node once the focus settles', async () => {
    const host = new FakeThemeHost();
    const { result } = renderHook(() => useGameCount(n64, 0), { wrapper: withHost(host) });
    expect(result.current).toEqual({ kind: 'games', count: null, loading: true });
    await waitFor(() => {
      expect(result.current).toEqual({ kind: 'games', count: 8, loading: false });
    });
  });

  it('never loads a node that lost focus before settling', async () => {
    const host = new FakeThemeHost();
    const { result, rerender } = renderHook(({ node }) => useGameCount(node, 30), {
      wrapper: withHost(host),
      initialProps: { node: n64 },
    });
    rerender({ node: genesis });
    await waitFor(() => {
      expect(result.current).toEqual({ kind: 'games', count: 8, loading: false });
    });
    expect(getGamesCalls(host)).toEqual(['s:genesis']);
  });

  it('reuses a count, and loads it again after the library changes', async () => {
    const host = new FakeThemeHost();
    const first = renderHook(() => useGameCount(genesis, 0), { wrapper: withHost(host) });
    await waitFor(() => {
      expect(first.result.current).toMatchObject({ count: 8 });
    });
    first.unmount();
    const second = renderHook(() => useGameCount(genesis, 0), { wrapper: withHost(host) });
    expect(second.result.current).toMatchObject({ count: 8, loading: false });
    host.setGames(FIXTURE_GAMES.filter((g) => g.systemId !== 'genesis' || g.title !== 'Genesis A'));
    act(() => {
      host.emit({ type: 'library-changed', systems: ['genesis'] });
    });
    await waitFor(() => {
      expect(second.result.current).toMatchObject({ count: 7, loading: false });
    });
    expect(getGamesCalls(host)).toEqual(['s:genesis', 's:genesis']);
  });

  it('a menu node whose children are all filters counts as games when asked to', async () => {
    const host = new FakeThemeHost();
    const { result } = renderHook(() => useGameCount(snes, 0, { filtersAsGames: true }), {
      wrapper: withHost(host),
    });
    await waitFor(() => {
      expect(result.current).toEqual({ kind: 'games', count: 10, loading: false });
    });
  });

  it('returns null without a node', () => {
    const { result } = renderHook(() => useGameCount(null, 0), {
      wrapper: withHost(new FakeThemeHost()),
    });
    expect(result.current).toBeNull();
  });

  it('countLabel words the count through i18n', () => {
    expect(countLabel(null, t)).toBe('');
    expect(countLabel({ kind: 'items', count: 2 }, t)).toBe('themes.count.items:2');
    expect(countLabel({ kind: 'games', count: null, loading: true }, t)).toBe('…');
    expect(countLabel({ kind: 'games', count: 1, loading: false }, t)).toBe('themes.count.games:1');
  });
});

const game: ThemeGame = {
  ...(FIXTURE_GAMES[0] as ThemeGame),
  title: 'The Decathlon',
  year: 1983,
  developer: 'Crane Soft',
  genre: 'Sports',
};

describe('GameDetailPanel (FR-THM-1, FR-THM-6)', () => {
  it('plainDescription strips markup', () => {
    expect(plainDescription('Ten <b>events</b>.<br>Best wins!')).toBe('Ten events.\nBest wins!');
  });

  it('renders title, meta and a working Play button', () => {
    const onLaunch = vi.fn();
    render(<GameDetailPanel game={game} onLaunch={onLaunch} settleMs={0} />, {
      wrapper: withHost(new FakeThemeHost()),
    });
    expect(screen.getByText('The Decathlon')).toBeInTheDocument();
    expect(screen.getByText('1983 · Crane Soft · Sports')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Play/ }));
    expect(onLaunch).toHaveBeenCalledWith(game);
  });

  it('loads the description from the host once the focus settles', async () => {
    render(<GameDetailPanel game={game} onLaunch={vi.fn()} settleMs={0} />, {
      wrapper: withHost(new FakeThemeHost()),
    });
    expect(await screen.findByText(`About game ${String(game.id)}`)).toBeInTheDocument();
  });

  it('renders nothing when there is no game', () => {
    const { container } = render(<GameDetailPanel game={null} onLaunch={vi.fn()} />, {
      wrapper: withHost(new FakeThemeHost()),
    });
    expect(container).toBeEmptyDOMElement();
  });
});
