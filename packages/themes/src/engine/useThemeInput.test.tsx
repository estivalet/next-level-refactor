// Cases ported from NextLevelOS src/themes/engine/useThemeInput.test.tsx @ 3d530b7, driven by input
// actions (keyboard here; gamepad goes through the same path) instead of KeyboardEvent.key.
import { defaultSettings } from '@nextlevel/shared';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { ThemeEngineProvider } from './ThemeEngineProvider.tsx';
import type { KeyMap, NavIntentKind } from './types.ts';
import { useFilterLayout } from './useFilterLayout.ts';
import { useThemeInput } from './useThemeInput.ts';
import { useThemeNavigation, type ThemeNavigation } from './useThemeNavigation.ts';

const KEYMAP: KeyMap = {
  left: 'focus-prev',
  right: 'focus-next',
  select: 'enter',
  back: 'back',
  home: 'home',
  favorite: 'toggle-favorite',
};

function Harness(props: { enabled?: boolean; onIntent?: (intent: NavIntentKind) => boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const nav = useThemeNavigation();
  useThemeInput({
    targetRef: ref,
    keymap: KEYMAP,
    enabled: props.enabled ?? true,
    ...(props.onIntent ? { onIntent: props.onIntent } : {}),
  });
  return (
    <div ref={ref} tabIndex={0} data-testid="root">
      <span data-testid="focus">{nav.state.focusIndex}</span>
      <span data-testid="depth">{nav.state.stack.length}</span>
    </div>
  );
}

function setup(host = new FakeThemeHost(), props: Parameters<typeof Harness>[0] = {}) {
  const onExit = vi.fn();
  render(
    <ThemeEngineProvider host={host} onExit={onExit}>
      <Harness {...props} />
    </ThemeEngineProvider>,
  );
  const press = (code: string) => {
    const root = screen.getByTestId('root');
    fireEvent.keyDown(root, { code });
    fireEvent.keyUp(root, { code });
  };
  return { press, onExit, host };
}

const focus = () => screen.getByTestId('focus').textContent;
const depth = () => screen.getByTestId('depth').textContent;

describe('useThemeInput (FR-THM-3)', () => {
  it('right moves focus and wraps around', async () => {
    const { press } = setup();
    await waitFor(() => {
      expect(depth()).toBe('1');
    });
    press('ArrowRight');
    expect(focus()).toBe('1');
    press('ArrowRight');
    press('ArrowRight');
    expect(focus()).toBe('0');
    press('ArrowLeft');
    expect(focus()).toBe('2');
  });

  it('select drills in, back backs out, back at the root exits', async () => {
    const { press, onExit } = setup();
    await waitFor(() => {
      expect(depth()).toBe('1');
    });
    press('Enter');
    expect(depth()).toBe('2');
    press('Escape');
    expect(depth()).toBe('1');
    press('Escape');
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('intents without built-in handling go to onIntent; true suppresses built-ins', async () => {
    const seen: NavIntentKind[] = [];
    const { press } = setup(new FakeThemeHost(), {
      onIntent: (intent) => {
        seen.push(intent);
        return intent === 'focus-next';
      },
    });
    await waitFor(() => {
      expect(depth()).toBe('1');
    });
    press('KeyX');
    press('ArrowRight');
    expect(seen).toEqual(['toggle-favorite', 'focus-next']);
    expect(focus()).toBe('0');
  });

  it("follows the user's remapped keys", async () => {
    const input = defaultSettings().input;
    const remapped = { ...input, keyboard: { ...input.keyboard, right: ['KeyD'] } };
    const { press } = setup(new FakeThemeHost({ input: remapped }));
    await waitFor(() => {
      expect(depth()).toBe('1');
    });
    press('ArrowRight');
    press('KeyD');
    expect(focus()).toBe('1');
  });

  it('does nothing while disabled', async () => {
    const { press } = setup(new FakeThemeHost(), { enabled: false });
    await waitFor(() => {
      expect(depth()).toBe('1');
    });
    press('ArrowRight');
    expect(focus()).toBe('0');
  });
});

function layoutSetup() {
  const host = new FakeThemeHost();
  const nav: { current: ThemeNavigation | null } = { current: null };
  let layout = true;
  function Theme() {
    const navigation = useThemeNavigation();
    useFilterLayout(layout);
    useEffect(() => {
      nav.current = navigation;
    });
    const level = navigation.currentLevel;
    return (
      <span data-testid="top">
        {level ? `${level.kind}:${String(navigation.state.stack.length)}` : ''}
      </span>
    );
  }
  const tree = () => (
    <ThemeEngineProvider host={host} onExit={() => undefined}>
      <Theme />
    </ThemeEngineProvider>
  );
  const { rerender } = render(tree());
  return {
    nav: () => {
      if (!nav.current) throw new Error('not rendered');
      return nav.current;
    },
    setLayout: (filtersInMenu: boolean) => {
      layout = filtersInMenu;
      rerender(tree());
    },
  };
}

describe('useFilterLayout (FR-THM-1)', () => {
  it('a theme with filters as tabs turns an open filter menu into the tabbed game list', async () => {
    const { nav, setLayout } = layoutSetup();
    await waitFor(() => {
      expect(nav().state.status).toBe('ready');
    });
    act(() => {
      nav().enter(0);
    });
    act(() => {
      nav().enter(0);
    });
    expect(screen.getByTestId('top').textContent).toBe('menu:3');
    setLayout(false);
    await waitFor(() => {
      expect(screen.getByTestId('top').textContent).toBe('games:3');
    });
  });
});
