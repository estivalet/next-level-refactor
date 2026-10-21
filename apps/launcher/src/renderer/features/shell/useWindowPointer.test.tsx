import { act, renderHook } from '@testing-library/react';
import type { PointerEvent, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ShellProvider, useShell } from './ShellContext.tsx';
import { useWindowPointer } from './useWindowPointer.ts';
import type { ShellWindow } from './windowManager.ts';

function wrapper({ children }: { children: ReactNode }) {
  return <ShellProvider initialBounds={{ width: 1200, height: 800 }}>{children}</ShellProvider>;
}

function pointer(x: number, y: number): PointerEvent<HTMLElement> {
  const element = document.createElement('div');
  return {
    button: 0,
    pointerId: 1,
    clientX: x,
    clientY: y,
    target: element,
    currentTarget: Object.assign(element, { setPointerCapture: () => undefined }),
  } as unknown as PointerEvent<HTMLElement>;
}

const PLACEHOLDER: ShellWindow = {
  id: 'none',
  appId: 'none',
  rect: { x: 0, y: 0, width: 0, height: 0 },
  minimized: false,
  maximized: false,
  z: 0,
};

const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 50));

function setup() {
  const { result } = renderHook(
    () => {
      const shell = useShell();
      // Hooks can't be conditional, so a placeholder stands in until the window opens.
      const win = shell.state.windows[0] ?? PLACEHOLDER;
      return { shell, drag: useWindowPointer('drag', win) };
    },
    { wrapper },
  );
  act(() => {
    result.current.shell.dispatch({
      type: 'open',
      appId: 'settings',
      size: { width: 600, height: 400 },
      singleInstance: true,
    });
  });
  return result;
}

describe('useWindowPointer', () => {
  it('FR-SHELL-2: dragging moves the window', async () => {
    const result = setup();
    const start = result.current.shell.state.windows[0]?.rect;
    act(() => {
      result.current.drag.onPointerDown(pointer(10, 10));
      result.current.drag.onPointerMove(pointer(60, 30));
    });
    await act(nextFrame);
    expect(result.current.shell.state.windows[0]?.rect.x).toBe((start?.x ?? 0) + 50);
  });

  it('FR-SHELL-2: a cancelled pointer ends the drag; later hovering does not move the window', async () => {
    const result = setup();
    const start = result.current.shell.state.windows[0]?.rect;
    act(() => {
      result.current.drag.onPointerDown(pointer(10, 10));
      result.current.drag.onPointerCancel();
      result.current.drag.onPointerMove(pointer(300, 300));
    });
    await act(nextFrame);
    expect(result.current.shell.state.windows[0]?.rect).toEqual(start);
  });

  it('FR-SHELL-2: losing pointer capture ends the drag', async () => {
    const result = setup();
    const start = result.current.shell.state.windows[0]?.rect;
    act(() => {
      result.current.drag.onPointerDown(pointer(10, 10));
      result.current.drag.onLostPointerCapture();
      result.current.drag.onPointerMove(pointer(300, 300));
    });
    await act(nextFrame);
    expect(result.current.shell.state.windows[0]?.rect).toEqual(start);
  });
});
