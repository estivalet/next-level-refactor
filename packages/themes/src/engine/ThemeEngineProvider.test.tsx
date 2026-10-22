// Cases ported from NextLevelOS src/themes/engine/ThemeEngineProvider.test.tsx @ 3d530b7, on a
// FakeThemeHost instead of fetch and window.electronAPI.
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeThemeHost, type HostFixture } from '../host/FakeThemeHost.ts';
import { FIXTURE_GAMES } from '../host/fixtures.ts';
import { ThemeEngineProvider } from './ThemeEngineProvider.tsx';
import { useThemeNavigation, type ThemeNavigation } from './useThemeNavigation.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(host = new FakeThemeHost(), onExit = vi.fn()) {
  const nav: { current: ThemeNavigation | null } = { current: null };
  function Probe() {
    nav.current = useThemeNavigation();
    return null;
  }
  render(
    <ThemeEngineProvider host={host} onExit={onExit}>
      <Probe />
    </ThemeEngineProvider>,
  );
  const get = () => {
    if (!nav.current) throw new Error('not rendered');
    return nav.current;
  };
  const ready = () =>
    waitFor(() => {
      expect(get().state.status).toBe('ready');
    });
  const loaded = () =>
    waitFor(() => {
      const level = get().currentLevel;
      expect(level?.kind === 'games' && !level.loading).toBe(true);
    });
  const games = () => {
    const level = get().currentLevel;
    return level?.kind === 'games' ? level.games : [];
  };
  return { host, onExit, get, ready, loaded, games };
}

/** Root → Nintendo → Nintendo 64 (a plain system). */
async function openN64(ctx: ReturnType<typeof setup>) {
  await ctx.ready();
  act(() => {
    ctx.get().enter(0);
  });
  act(() => {
    ctx.get().enter(1);
  });
  await ctx.loaded();
}

describe('ThemeEngineProvider (FR-THM-1, FR-THM-6)', () => {
  it('loads the menu from the host into a ready root level', async () => {
    const ctx = setup();
    await ctx.ready();
    const level = ctx.get().currentLevel;
    expect(level?.kind === 'menu' && level.items.map((node) => node.id)).toEqual([
      'm:nintendo',
      'm:sega',
      'm:collections',
    ]);
  });

  it('enter drills into a category, then loads a system level from the host', async () => {
    const ctx = setup();
    await openN64(ctx);
    expect(ctx.games()).toHaveLength(8);
    expect(ctx.get().currentLevel).toMatchObject({ kind: 'games', systemId: 'n64' });
    expect(ctx.host.calls).toContainEqual({ method: 'getGames', args: ['s:n64'] });
  });

  it('a filter level loads only that filter, under its system', async () => {
    const ctx = setup();
    await ctx.ready();
    act(() => {
      ctx.get().enter(0);
    });
    act(() => {
      ctx.get().enter(0);
    });
    act(() => {
      ctx.get().enter(1);
    });
    await ctx.loaded();
    expect(ctx.games().map((game) => game.title)).toEqual(['Homebrew A', 'Homebrew B']);
    expect(ctx.get().currentLevel).toMatchObject({ systemId: 'snes', filter: 'homebrew' });
  });

  it('flattenFilters opens the whole system as one level with its filters as tabs', async () => {
    const ctx = setup();
    await ctx.ready();
    act(() => {
      ctx.get().enter(0);
    });
    act(() => {
      ctx.get().enter(0, { flattenFilters: true });
    });
    await ctx.loaded();
    expect(ctx.games()).toHaveLength(10);
    const level = ctx.get().currentLevel;
    expect(level?.kind === 'games' && level.filterTabs?.map((tab) => tab.filter)).toEqual([
      'official',
      'homebrew',
    ]);
  });

  it('back at the root calls onExit', async () => {
    const ctx = setup();
    await ctx.ready();
    act(() => {
      ctx.get().back();
    });
    expect(ctx.onExit).toHaveBeenCalledOnce();
  });

  it('selectRoot puts one root item below the root and loads a games level', async () => {
    const ctx = setup();
    await ctx.ready();
    act(() => {
      ctx.get().selectRoot(1);
    });
    expect(ctx.get().state.stack).toHaveLength(2);
    expect(ctx.get().state.stack[0]?.lastFocusIndex).toBe(1);
    act(() => {
      ctx.get().selectRoot(99);
    });
    expect(ctx.get().state.stack).toHaveLength(2);
  });

  it('useThemeNavigation outside the provider throws', () => {
    function Lost() {
      useThemeNavigation();
      return null;
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Lost />)).toThrow(/ThemeEngineProvider/);
  });

  it('a menu failure is an error state that retry recovers from', async () => {
    const host = new FakeThemeHost();
    const getMenu = vi.spyOn(host, 'getMenu').mockRejectedValueOnce(new Error('down'));
    const ctx = setup(host);
    await waitFor(() => {
      expect(ctx.get().state).toMatchObject({ status: 'error', error: 'down' });
    });
    act(() => {
      ctx.get().retry();
    });
    await ctx.ready();
    expect(getMenu).toHaveBeenCalledTimes(2);
  });

  it('a games failure shows on the level', async () => {
    const host = new FakeThemeHost();
    vi.spyOn(host, 'getGames').mockRejectedValueOnce(new Error('library closed'));
    const ctx = setup(host);
    await ctx.ready();
    act(() => {
      ctx.get().enter(0);
    });
    act(() => {
      ctx.get().enter(1);
    });
    await waitFor(() => {
      expect(ctx.get().currentLevel).toMatchObject({ loading: false, error: 'library closed' });
    });
  });

  it('a slow level that arrives after the user moved on is dropped', async () => {
    const host = new FakeThemeHost();
    let release: () => void = () => undefined;
    const real = host.getGames.bind(host);
    vi.spyOn(host, 'getGames').mockImplementationOnce(
      (nodeId) =>
        new Promise((resolve) => {
          release = () => {
            void real(nodeId).then(resolve);
          };
        }),
    );
    const ctx = setup(host);
    await ctx.ready();
    act(() => {
      ctx.get().enter(0);
    });
    act(() => {
      ctx.get().enter(1);
    });
    act(() => {
      ctx.get().back();
    });
    act(() => {
      ctx.get().back();
    });
    act(() => {
      ctx.get().enter(1);
    });
    act(() => {
      ctx.get().enter(0);
    });
    await ctx.loaded();
    await act(async () => {
      release();
      await Promise.resolve();
    });
    expect(ctx.games().every((game) => game.systemId === 'genesis')).toBe(true);
  });

  it('FR-THM-6: never reads data files or the launcher bridge', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    Object.defineProperty(window, 'nextlevel', {
      configurable: true,
      get: () => {
        throw new Error('themes must not touch window.nextlevel');
      },
    });
    const ctx = setup();
    await openN64(ctx);
    expect(fetchSpy).not.toHaveBeenCalled();
    Reflect.deleteProperty(window, 'nextlevel');
  });
});

describe('game flags and host events', () => {
  it('FR-LIB-7: a flag change shows at once and is saved through the host', async () => {
    const ctx = setup();
    await openN64(ctx);
    const game = ctx.games()[0];
    if (!game) throw new Error('fixture');
    let saved = false;
    await act(async () => {
      saved = await ctx.get().updateGameFlags(game, { favorite: true });
    });
    expect(saved).toBe(true);
    expect(ctx.games()[0]?.favorite).toBe(true);
    expect(ctx.host.calls).toContainEqual({
      method: 'setGameFlags',
      args: [game.id, { favorite: true }],
    });
  });

  it('FR-LIB-7: a flag change the host could not save is rolled back', async () => {
    const ctx = setup(new FakeThemeHost({ failFlags: true } satisfies HostFixture));
    await openN64(ctx);
    const game = ctx.games()[0];
    if (!game) throw new Error('fixture');
    let saved = true;
    await act(async () => {
      saved = await ctx.get().updateGameFlags(game, { hidden: true });
    });
    expect(saved).toBe(false);
    expect(ctx.games()[0]?.hidden).toBe(false);
  });

  it('US-C2: after a launch finishes, focus is on that game', async () => {
    const ctx = setup();
    await openN64(ctx);
    const target = ctx.games()[5];
    if (!target) throw new Error('fixture');
    act(() => {
      ctx.host.emit({ type: 'launch-finished', gameId: target.id, ok: true });
    });
    expect(ctx.get().state.focusIndex).toBe(5);
    expect(ctx.get().focusedGame?.id).toBe(target.id);
  });

  it('a library change refreshes the open level and keeps focus on the same game', async () => {
    const ctx = setup();
    await openN64(ctx);
    act(() => {
      ctx.get().setFocus(3);
    });
    const focused = ctx.get().focusedGame;
    // A new game sorts first: the focused game moves down one place.
    const n64 = FIXTURE_GAMES[10];
    if (!n64) throw new Error('fixture');
    const extra = { ...n64, id: 999, title: 'A new game' };
    ctx.host.setGames([extra, ...FIXTURE_GAMES]);
    await act(async () => {
      ctx.host.emit({ type: 'library-changed' });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(ctx.games()).toHaveLength(9);
    });
    expect(ctx.get().focusedGame?.id).toBe(focused?.id);
    expect(ctx.get().state.focusIndex).toBe(4);
  });

  it('a library change that removes the focused game keeps the index in range', async () => {
    const ctx = setup();
    await openN64(ctx);
    act(() => {
      ctx.get().setFocus(7);
    });
    ctx.host.setGames(
      FIXTURE_GAMES.filter((game) => game.systemId !== 'n64' || game.title < 'N64 F'),
    );
    await act(async () => {
      ctx.host.emit({ type: 'library-changed', gameIds: [18] });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(ctx.games()).toHaveLength(5);
    });
    expect(ctx.get().state.focusIndex).toBe(4);
  });
});
