import { describe, expect, it } from 'vitest';
import {
  CASCADE_STEP,
  MIN_WINDOW,
  TITLE_BAR_HEIGHT,
  initialWindowState,
  windowReducer,
  type WindowAction,
  type WindowState,
} from './windowManager.ts';

const BOUNDS = { width: 1200, height: 800 };
const SIZE = { width: 600, height: 400 };

function run(...actions: WindowAction[]): WindowState {
  return actions.reduce(windowReducer, initialWindowState(BOUNDS));
}

function open(appId: string, singleInstance = false): Extract<WindowAction, { type: 'open' }> {
  return { type: 'open', appId, size: SIZE, singleInstance };
}

function win(state: WindowState, id: string) {
  const found = state.windows.find((w) => w.id === id);
  if (!found) throw new Error(`no window ${id}`);
  return found;
}

describe('windowReducer', () => {
  it('FR-SHELL-1: open adds a focused, centred window with a sequential id', () => {
    const state = run(open('settings'));
    expect(state.windows).toHaveLength(1);
    expect(state.focusedId).toBe('settings-1');
    expect(win(state, 'settings-1')).toMatchObject({
      appId: 'settings',
      rect: { x: 300, y: 200, width: 600, height: 400 },
      minimized: false,
      maximized: false,
    });
  });

  it('FR-SHELL-1: each new window cascades and goes on top', () => {
    const state = run(open('a'), open('b'));
    const [a, b] = [win(state, 'a-1'), win(state, 'b-2')];
    expect(b.rect.x - a.rect.x).toBe(CASCADE_STEP);
    expect(b.rect.y - a.rect.y).toBe(CASCADE_STEP);
    expect(b.z).toBeGreaterThan(a.z);
    expect(state.focusedId).toBe('b-2');
  });

  it('FR-SHELL-1: a window larger than the desktop is shrunk to fit', () => {
    const state = windowReducer(initialWindowState(BOUNDS), {
      type: 'open',
      appId: 'big',
      size: { width: 5000, height: 5000 },
      singleInstance: false,
    });
    expect(win(state, 'big-1').rect).toEqual({ x: 0, y: 0, width: 1200, height: 800 });
  });

  it('FR-SHELL-3: opening a single-instance app twice keeps one window', () => {
    const state = run(open('settings', true), open('settings', true));
    expect(state.windows).toHaveLength(1);
  });

  it('FR-SHELL-3: opening a minimized single-instance app restores and focuses it', () => {
    const state = run(
      open('settings', true),
      open('other'),
      { type: 'toggleMinimize', id: 'settings-1' },
      open('settings', true),
    );
    expect(win(state, 'settings-1').minimized).toBe(false);
    expect(state.focusedId).toBe('settings-1');
    expect(win(state, 'settings-1').z).toBeGreaterThan(win(state, 'other-2').z);
  });

  it('FR-SHELL-3: apps that allow several open a second window', () => {
    expect(run(open('notes'), open('notes')).windows).toHaveLength(2);
  });

  it('FR-SHELL-2: focus raises the window and un-minimizes it', () => {
    const state = run(open('a'), open('b'), { type: 'focus', id: 'a-1' });
    expect(state.focusedId).toBe('a-1');
    expect(win(state, 'a-1').z).toBeGreaterThan(win(state, 'b-2').z);
  });

  it('FR-SHELL-2: focusing the focused top window changes nothing', () => {
    const before = run(open('a'));
    expect(windowReducer(before, { type: 'focus', id: 'a-1' })).toBe(before);
  });

  it('FR-SHELL-2: closing the focused window focuses the next highest visible one', () => {
    const state = run(
      open('a'),
      open('b'),
      open('c'),
      { type: 'toggleMinimize', id: 'b-2' },
      { type: 'focus', id: 'c-3' },
      { type: 'close', id: 'c-3' },
    );
    expect(state.windows.map((w) => w.id)).toEqual(['a-1', 'b-2']);
    expect(state.focusedId).toBe('a-1');
  });

  it('FR-SHELL-2: closing the last window clears focus', () => {
    expect(run(open('a'), { type: 'close', id: 'a-1' }).focusedId).toBeNull();
  });

  it('FR-SHELL-2: minimizing the focused window moves focus; restoring focuses it', () => {
    const minimized = run(open('a'), open('b'), { type: 'toggleMinimize', id: 'b-2' });
    expect(win(minimized, 'b-2').minimized).toBe(true);
    expect(minimized.focusedId).toBe('a-1');

    const restored = windowReducer(minimized, { type: 'toggleMinimize', id: 'b-2' });
    expect(win(restored, 'b-2').minimized).toBe(false);
    expect(restored.focusedId).toBe('b-2');
  });

  it('FR-SHELL-2: maximize toggles, focuses and keeps the restore rect', () => {
    const opened = run(open('a'), open('b'));
    const rect = win(opened, 'a-1').rect;
    const maximized = windowReducer(opened, { type: 'toggleMaximize', id: 'a-1' });
    expect(win(maximized, 'a-1').maximized).toBe(true);
    expect(maximized.focusedId).toBe('a-1');
    const restored = windowReducer(maximized, { type: 'toggleMaximize', id: 'a-1' });
    expect(win(restored, 'a-1')).toMatchObject({ maximized: false, rect });
  });

  it('FR-SHELL-2: move keeps the title bar reachable', () => {
    const base = run(open('a'));
    const farRight = windowReducer(base, { type: 'move', id: 'a-1', x: 5000, y: 5000 });
    expect(win(farRight, 'a-1').rect).toMatchObject({ x: 1200 - 80, y: 800 - TITLE_BAR_HEIGHT });
    const farLeft = windowReducer(base, { type: 'move', id: 'a-1', x: -5000, y: -50 });
    expect(win(farLeft, 'a-1').rect).toMatchObject({ x: -(600 - 80), y: 0 });
  });

  it('FR-SHELL-2: resize enforces the minimum and the desktop size', () => {
    const base = run(open('a'));
    const tiny = windowReducer(base, { type: 'resize', id: 'a-1', width: 10, height: 10 });
    expect(win(tiny, 'a-1').rect).toMatchObject(MIN_WINDOW);
    const huge = windowReducer(base, { type: 'resize', id: 'a-1', width: 9999, height: 9999 });
    expect(win(huge, 'a-1').rect).toMatchObject({ width: 1200, height: 800 });
  });

  it('FR-SHELL-2: shrinking the desktop re-clamps windows near the edge', () => {
    const moved = run(open('a'), { type: 'move', id: 'a-1', x: 1000, y: 700 });
    const shrunk = windowReducer(moved, { type: 'setBounds', bounds: { width: 800, height: 600 } });
    expect(shrunk.bounds).toEqual({ width: 800, height: 600 });
    expect(win(shrunk, 'a-1').rect).toMatchObject({ x: 800 - 80, y: 600 - TITLE_BAR_HEIGHT });
  });

  it('FR-SHELL-2: a degenerate desktop size (e.g. while minimized) is ignored', () => {
    const before = run(open('a'));
    const after = windowReducer(before, { type: 'setBounds', bounds: { width: 0, height: 0 } });
    expect(after).toBe(before);
  });

  it('US-C2: opening a single-instance app with params passes them on, also to its open window', () => {
    const params = { section: 'systems', focusId: 'snes' };
    const first = run({ ...open('settings', true), params });
    expect(win(first, 'settings-1').params).toEqual(params);
    const again = windowReducer(first, {
      ...open('settings', true),
      params: { section: 'emulators' },
    });
    expect(again.windows).toHaveLength(1);
    expect(win(again, 'settings-1').params).toEqual({ section: 'emulators' });
    expect(win(windowReducer(again, open('settings', true)), 'settings-1').params).toEqual({
      section: 'emulators',
    });
  });

  it('ignores actions for unknown windows', () => {
    const before = run(open('a'));
    expect(windowReducer(before, { type: 'close', id: 'nope' })).toEqual(before);
    expect(windowReducer(before, { type: 'focus', id: 'nope' })).toBe(before);
  });
});
