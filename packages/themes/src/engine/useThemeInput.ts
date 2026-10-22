// Ported from NextLevelOS src/themes/engine/useThemeInput.ts @ 3d530b7: the theme's keymap maps
// input actions (keys and gamepad buttons from the user's settings) to intents (FR-THM-3).
import type { InputSettings } from '@nextlevel/shared';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ThemeHost } from '../host/ThemeHost.ts';
import { useInputActions } from '../input/useInputActions.ts';
import type { KeyMap, NavIntentKind } from './types.ts';

/** Intents a held input repeats; any other intent fires once per press. */
const REPEATING_INTENTS = new Set<NavIntentKind>([
  'focus-prev',
  'focus-next',
  'focus-up',
  'focus-down',
  'jump-prev',
  'jump-next',
  'page-prev',
  'page-next',
]);
import { useThemeHost, useThemeNavigation } from './useThemeNavigation.ts';

/** The user's input settings, kept current when Settings change. */
export function useHostInput(host: ThemeHost): InputSettings {
  const [input, setInput] = useState(() => host.input());
  useEffect(
    () =>
      host.onEvent((event) => {
        if (event.type === 'settings-changed') setInput(host.input());
      }),
    [host],
  );
  return input;
}

/**
 * Drives the engine from input: each action becomes the theme's intent. `onIntent` sees every
 * intent first and returns true to take it over; otherwise previous/next focus (wrapping),
 * enter (open a menu item or play the focused game), back, home and search are built in.
 */
export function useThemeInput(opts: {
  targetRef: RefObject<HTMLElement | null>;
  keymap: KeyMap;
  enabled?: boolean;
  onToggleSearch?: () => void;
  /** Return `true` to take the intent over from the built-in handling. */
  onIntent?: (intent: NavIntentKind) => unknown;
}) {
  const { targetRef, keymap, enabled = true } = opts;
  const nav = useThemeNavigation();
  const input = useHostInput(useThemeHost());
  // Read through refs: the theme passes fresh closures and `nav` changes on every render.
  const latest = useRef({ nav, opts });
  latest.current = { nav, opts };

  useInputActions({
    targetRef,
    enabled,
    input,
    onAction: (action, { repeat }) => {
      const intent = keymap[action];
      // Holding repeats moves only: a held Up bound to "enter" must not dive into a launch.
      if (!intent || (repeat && !REPEATING_INTENTS.has(intent))) return;
      const { nav: current, opts: options } = latest.current;
      if (options.onIntent?.(intent) === true) return;
      const level = current.currentLevel;
      const count =
        level?.kind === 'menu'
          ? level.items.length
          : level?.kind === 'games'
            ? level.games.length
            : 0;
      const focus = current.state.focusIndex;
      switch (intent) {
        case 'focus-prev':
          if (count > 0) current.setFocus((focus - 1 + count) % count);
          break;
        case 'focus-next':
          if (count > 0) current.setFocus((focus + 1) % count);
          break;
        case 'enter':
          if (level?.kind === 'menu') current.enter(focus);
          else if (current.focusedGame) void current.launch(current.focusedGame);
          break;
        case 'back':
          current.back();
          break;
        case 'home':
          current.home();
          break;
        case 'toggle-search':
          options.onToggleSearch?.();
          break;
        default:
          break;
      }
    },
  });
}
