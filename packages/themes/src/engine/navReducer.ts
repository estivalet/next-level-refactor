// Ported from NextLevelOS src/themes/engine/navReducer.ts @ 3d530b7 (games patched by id).
import type { EngineState, Level, NavAction } from './types.ts';

export function initialEngineState(): EngineState {
  return { stack: [], focusIndex: 0, status: 'loading' };
}

const levelCount = (level: Level) =>
  level.kind === 'menu' ? level.items.length : level.games.length;

const clamp = (index: number, max: number) => (max <= 0 ? 0 : Math.max(0, Math.min(index, max)));

/** The state with its top level replaced; unchanged when the stack is empty. */
function withTop(state: EngineState, change: (top: Level) => Level | null): EngineState {
  const top = state.stack[state.stack.length - 1];
  if (!top) return state;
  const next = change(top);
  if (!next || next === top) return state;
  return { ...state, stack: [...state.stack.slice(0, -1), next] };
}

type GamesLevel = Extract<Level, { kind: 'games' }>;

const onGames = (change: (top: GamesLevel) => GamesLevel | null) => (top: Level) =>
  top.kind === 'games' ? change(top) : null;

export function navReducer(state: EngineState, action: NavAction): EngineState {
  switch (action.type) {
    case 'menu-loaded': {
      const root: Level = {
        kind: 'menu',
        node: null,
        items: action.items,
        title: action.title,
        lastFocusIndex: 0,
      };
      return { stack: [root], focusIndex: 0, status: 'ready' };
    }

    case 'menu-failed':
      return { ...state, status: 'error', error: action.error };

    case 'set-focus': {
      const top = state.stack[state.stack.length - 1];
      if (!top) return state;
      const focusIndex = clamp(action.index, levelCount(top) - 1);
      return { ...withTop(state, () => ({ ...top, lastFocusIndex: focusIndex })), focusIndex };
    }

    case 'push': {
      if (state.stack.length === 0) return state;
      const remembered = withTop(state, (top) => ({ ...top, lastFocusIndex: state.focusIndex }));
      return {
        ...remembered,
        stack: [...remembered.stack, action.level],
        focusIndex: action.level.lastFocusIndex,
      };
    }

    case 'back': {
      const parent = state.stack[state.stack.length - 2];
      if (!parent) return state;
      return { ...state, stack: state.stack.slice(0, -1), focusIndex: parent.lastFocusIndex };
    }

    case 'home': {
      const root = state.stack[0];
      if (!root) return state;
      return { ...state, stack: [root], focusIndex: root.lastFocusIndex };
    }

    case 'patch-games':
      return withTop(
        state,
        onGames((top) => {
          const next = { ...top, games: action.games, loading: false };
          delete next.error;
          return next;
        }),
      );

    case 'patch-games-error':
      return withTop(
        state,
        onGames((top) => ({ ...top, loading: false, error: action.error })),
      );

    case 'patch-game':
      return withTop(
        state,
        onGames((top) => {
          if (!top.games.some((game) => game.id === action.gameId)) return null;
          const games = top.games.map((game) =>
            game.id === action.gameId ? { ...game, ...action.patch } : game,
          );
          return { ...top, games };
        }),
      );

    case 'select-root': {
      const root = state.stack[0];
      if (root?.kind !== 'menu') return state;
      return {
        ...state,
        stack: [{ ...root, lastFocusIndex: action.index }, action.level],
        focusIndex: action.level.lastFocusIndex,
      };
    }

    case 'replace-stack':
      return { ...state, stack: action.stack, focusIndex: action.focusIndex };

    case 'set-filter-tab':
      return withTop(
        state,
        onGames((top) => {
          if (!top.filterTabs || top.filterTab === action.filterTab) return null;
          const next = { ...top };
          if (action.filterTab === undefined) delete next.filterTab;
          else next.filterTab = action.filterTab;
          return next;
        }),
      );
  }
}
