// Cases ported from NextLevelOS src/themes/engine/navReducer.test.ts @ 3d530b7.
import { describe, expect, it } from 'vitest';
import { initialEngineState, navReducer } from './navReducer.ts';
import { category, game, systemNode } from './testNodes.ts';
import type { EngineState, Level } from './types.ts';

const rootLoaded = navReducer(initialEngineState(), {
  type: 'menu-loaded',
  title: 'NextLevel',
  items: [category('Consoles', [category('A'), category('B')]), category('Arcade')],
});

const menuLevel = (names: string[], lastFocusIndex = 0): Level => ({
  kind: 'menu',
  node: category(
    'x',
    names.map((n) => category(n)),
  ),
  items: names.map((n) => category(n)),
  title: 'x',
  lastFocusIndex,
});

const gamesLevel = (games = [game(1), game(2), game(3)], loading = false): Level => ({
  kind: 'games',
  node: systemNode('atari', 'Atari 2600'),
  systemId: 'atari',
  systemName: 'Atari 2600',
  games,
  loading,
  lastFocusIndex: 0,
});

const top = (state: EngineState) => state.stack[state.stack.length - 1];

describe('navReducer (FR-THM-1)', () => {
  it('menu-loaded creates a single ready root level', () => {
    expect(rootLoaded.status).toBe('ready');
    expect(rootLoaded.stack).toHaveLength(1);
    expect(rootLoaded.stack[0]?.kind).toBe('menu');
    expect(rootLoaded.focusIndex).toBe(0);
  });

  it('menu-failed sets the error status', () => {
    const state = navReducer(initialEngineState(), { type: 'menu-failed', error: 'boom' });
    expect(state).toMatchObject({ status: 'error', error: 'boom' });
  });

  it('set-focus clamps to the level and remembers it', () => {
    expect(navReducer(rootLoaded, { type: 'set-focus', index: 99 }).focusIndex).toBe(1);
    expect(navReducer(rootLoaded, { type: 'set-focus', index: -5 }).focusIndex).toBe(0);
    const focused = navReducer(rootLoaded, { type: 'set-focus', index: 1 });
    expect(top(focused)?.lastFocusIndex).toBe(1);
    const empty = navReducer(rootLoaded, { type: 'push', level: menuLevel([]) });
    expect(navReducer(empty, { type: 'set-focus', index: 5 }).focusIndex).toBe(0);
    const games = navReducer(rootLoaded, { type: 'push', level: gamesLevel() });
    expect(navReducer(games, { type: 'set-focus', index: 99 }).focusIndex).toBe(2);
  });

  it('never mutates its input', () => {
    const input = navReducer(rootLoaded, { type: 'set-focus', index: 1 });
    Object.freeze(input);
    Object.freeze(input.stack);
    expect(navReducer(input, { type: 'set-focus', index: 0 }).focusIndex).toBe(0);
    expect(navReducer(input, { type: 'push', level: menuLevel(['p']) }).stack).toHaveLength(2);
  });

  it('push remembers the outgoing focus and back restores it', () => {
    const focused = navReducer(rootLoaded, { type: 'set-focus', index: 1 });
    const pushed = navReducer(focused, { type: 'push', level: menuLevel(['p', 'q', 'r'], 2) });
    expect(pushed.stack[0]?.lastFocusIndex).toBe(1);
    expect(pushed.focusIndex).toBe(2);
    const back = navReducer(pushed, { type: 'back' });
    expect(back.stack).toHaveLength(1);
    expect(back.focusIndex).toBe(1);
    expect(navReducer(rootLoaded, { type: 'back' })).toEqual(rootLoaded);
  });

  it('home truncates to the root and restores its focus', () => {
    const focused = navReducer(rootLoaded, { type: 'set-focus', index: 1 });
    const deep = navReducer(navReducer(focused, { type: 'push', level: menuLevel(['p']) }), {
      type: 'push',
      level: menuLevel(['x', 'y']),
    });
    const home = navReducer(deep, { type: 'home' });
    expect(home.stack).toHaveLength(1);
    expect(home.focusIndex).toBe(1);
  });

  it('patch-games fills the top games level and clears loading and error', () => {
    const pushed = navReducer(rootLoaded, {
      type: 'push',
      level: { ...gamesLevel([], true), error: 'previous' } as Level,
    });
    const patched = top(navReducer(pushed, { type: 'patch-games', games: [game(9)] }));
    expect(patched).toMatchObject({ kind: 'games', loading: false });
    expect(patched?.kind === 'games' && patched.games).toHaveLength(1);
    expect(patched?.kind === 'games' && patched.error).toBeUndefined();
  });

  it('patch-games-error sets the error; it is a no-op on a menu level', () => {
    const pushed = navReducer(rootLoaded, { type: 'push', level: gamesLevel([], true) });
    expect(top(navReducer(pushed, { type: 'patch-games-error', error: 'boom' }))).toMatchObject({
      error: 'boom',
      loading: false,
    });
    expect(navReducer(rootLoaded, { type: 'patch-games-error', error: 'boom' })).toBe(rootLoaded);
  });

  it('patch-game patches the game with that id only', () => {
    const pushed = navReducer(rootLoaded, { type: 'push', level: gamesLevel() });
    const next = navReducer(pushed, { type: 'patch-game', gameId: 2, patch: { hidden: true } });
    const level = top(next);
    if (level?.kind !== 'games') throw new Error('expected games');
    expect(level.games.map((g) => g.hidden)).toEqual([false, true, false]);
    expect(navReducer(pushed, { type: 'patch-game', gameId: 99, patch: { hidden: true } })).toBe(
      pushed,
    );
    expect(navReducer(rootLoaded, { type: 'patch-game', gameId: 1, patch: {} })).toBe(rootLoaded);
  });

  it('select-root replaces everything below the root with the selected branch', () => {
    const deep: EngineState = {
      ...rootLoaded,
      focusIndex: 3,
      stack: [...rootLoaded.stack, menuLevel(['a']), menuLevel(['b'])],
    };
    const arcade = menuLevel(['c']);
    const next = navReducer(deep, { type: 'select-root', index: 1, level: arcade });
    expect(next.stack).toHaveLength(2);
    expect(next.stack[0]?.lastFocusIndex).toBe(1);
    expect(next.stack[1]).toBe(arcade);
    expect(next.focusIndex).toBe(0);
    const empty = initialEngineState();
    expect(navReducer(empty, { type: 'select-root', index: 0, level: arcade })).toBe(empty);
  });

  it('set-filter-tab records the tab only on a flattened games level', () => {
    const flattened: Level = { ...gamesLevel(), filterTabs: [] } as Level;
    const pushed = navReducer(rootLoaded, { type: 'push', level: flattened });
    const next = top(navReducer(pushed, { type: 'set-filter-tab', filterTab: 'homebrew' }));
    expect(next?.kind === 'games' && next.filterTab).toBe('homebrew');
    const plain = navReducer(rootLoaded, { type: 'push', level: gamesLevel() });
    expect(navReducer(plain, { type: 'set-filter-tab', filterTab: 'x' })).toBe(plain);
  });
});
