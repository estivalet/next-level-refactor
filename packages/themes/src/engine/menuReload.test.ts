import { describe, expect, it } from 'vitest';
import type { MenuNode } from '@nextlevel/shared';
import { initialEngineState, navReducer } from './navReducer.ts';
import { category, filterNode, game, systemNode } from './testNodes.ts';
import type { EngineState, Level } from './types.ts';

const saturn = systemNode('saturn', 'Sega Saturn');
const genesis = systemNode('genesis', 'Sega Genesis');
const sega = category('Sega', [genesis, saturn]);
const nintendo = category('Nintendo', [systemNode('n64', 'Nintendo 64')]);
const arcade = category('Arcade');

const renamed = (node: MenuNode, display: string, children = node.children): MenuNode => ({
  ...node,
  name: display,
  display,
  children,
});

const loaded = (items: MenuNode[]) =>
  navReducer(initialEngineState(), { type: 'menu-loaded', title: 'NextLevel', items });

const reload = (state: EngineState, items: MenuNode[], title = 'NextLevel') =>
  navReducer(state, { type: 'menu-reloaded', items, title });

const top = (state: EngineState) => state.stack[state.stack.length - 1];

/** Root → Sega → Sega Saturn, with three games and focus on the second. */
function inSaturn(): EngineState {
  let state = navReducer(loaded([nintendo, sega]), { type: 'set-focus', index: 1 });
  state = navReducer(state, {
    type: 'push',
    level: { kind: 'menu', node: sega, items: sega.children, title: 'Sega', lastFocusIndex: 0 },
  });
  state = navReducer(state, { type: 'set-focus', index: 1 });
  const level: Level = {
    kind: 'games',
    node: saturn,
    systemId: 'saturn',
    systemName: saturn.name,
    games: [game(1), game(2), game(3)],
    loading: false,
    lastFocusIndex: 0,
  };
  state = navReducer(state, { type: 'push', level });
  return navReducer(state, { type: 'set-focus', index: 1 });
}

describe('menu-reloaded (US-D5)', () => {
  it('keeps focus on the same root node id when items move, and shows the new names', () => {
    const before = navReducer(loaded([nintendo, sega]), { type: 'set-focus', index: 1 });
    const next = reload(before, [arcade, nintendo, renamed(sega, 'SEGA')], 'Mine');
    expect(next.stack).toHaveLength(1);
    expect(next.focusIndex).toBe(2);
    const root = top(next);
    expect(root?.kind === 'menu' && root.items[2]?.display).toBe('SEGA');
    expect(root?.kind === 'menu' && root.title).toBe('Mine');
    expect(next.status).toBe('ready');
  });

  it('clamps the focus when the focused root node vanished', () => {
    const before = navReducer(loaded([nintendo, arcade, sega]), { type: 'set-focus', index: 2 });
    const next = reload(before, [nintendo, arcade]);
    expect(next.focusIndex).toBe(1);
  });

  it('keeps an open games level whose node still exists, with its games and focus', () => {
    const moved = renamed(sega, 'SEGA', [saturn, genesis]);
    const next = reload(inSaturn(), [arcade, nintendo, moved]);
    expect(next.stack.map((level) => level.node?.id ?? null)).toEqual([null, 'm:sega', 's:saturn']);
    expect(next.stack[0]?.lastFocusIndex).toBe(2);
    expect(next.stack[1]?.lastFocusIndex).toBe(0);
    expect(next.stack[1]?.kind === 'menu' && next.stack[1].title).toBe('SEGA');
    const games = top(next);
    expect(games?.kind === 'games' && games.games).toHaveLength(3);
    expect(next.focusIndex).toBe(1);
  });

  it('pops a games level whose node was removed back to its parent', () => {
    const next = reload(inSaturn(), [nintendo, renamed(sega, 'Sega', [genesis])]);
    expect(next.stack.map((level) => level.node?.id ?? null)).toEqual([null, 'm:sega']);
    expect(next.focusIndex).toBe(0);
  });

  it('drops every level below a removed category', () => {
    const next = reload(inSaturn(), [nintendo, arcade]);
    expect(next.stack).toHaveLength(1);
    expect(next.focusIndex).toBe(1);
  });

  it('a menu level whose system lost its filters becomes that system games level', () => {
    const snes = systemNode('snes', 'Super Nintendo', [
      filterNode('snes', 'Super Nintendo', 'official'),
      filterNode('snes', 'Super Nintendo', 'homebrew'),
    ]);
    let state = loaded([snes]);
    state = navReducer(state, {
      type: 'push',
      level: { kind: 'menu', node: snes, items: snes.children, title: 'SNES', lastFocusIndex: 0 },
    });
    const next = reload(state, [{ ...snes, children: [] }]);
    expect(top(next)).toMatchObject({ kind: 'games', systemId: 'snes', loading: true });
  });

  it('works like menu-loaded before the first menu arrived or after a failure', () => {
    const failed = navReducer(initialEngineState(), { type: 'menu-failed', error: 'x' });
    const next = reload(failed, [nintendo]);
    expect(next).toMatchObject({ status: 'ready', focusIndex: 0 });
    expect(next.stack).toHaveLength(1);
  });
});
