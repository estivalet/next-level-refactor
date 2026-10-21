// Window state for the desktop shell, as a pure reducer so every rule is unit-testable.

export type AppId = string;

export type Rect = { x: number; y: number; width: number; height: number };
export type Bounds = { width: number; height: number };
type Size = { width: number; height: number };

export interface ShellWindow {
  id: string;
  appId: AppId;
  rect: Rect;
  minimized: boolean;
  maximized: boolean;
  z: number;
}

export interface WindowState {
  windows: ShellWindow[];
  focusedId: string | null;
  nextZ: number;
  nextSeq: number;
  bounds: Bounds;
}

export type WindowAction =
  | { type: 'open'; appId: AppId; size: Size; singleInstance: boolean }
  | { type: 'close' | 'focus' | 'toggleMinimize' | 'toggleMaximize'; id: string }
  | { type: 'move'; id: string; x: number; y: number }
  | { type: 'resize'; id: string; width: number; height: number }
  | { type: 'setBounds'; bounds: Bounds };

export const MIN_WINDOW: Size = { width: 320, height: 200 };
export const TITLE_BAR_HEIGHT = 36;
export const CASCADE_STEP = 30;
/** How much of the title bar must stay on screen horizontally. */
const VISIBLE_GRIP = 80;

export function initialWindowState(bounds: Bounds): WindowState {
  return { windows: [], focusedId: null, nextZ: 1, nextSeq: 1, bounds };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

function clampSize(size: Size, bounds: Bounds): Size {
  return {
    width: Math.max(MIN_WINDOW.width, Math.min(size.width, bounds.width)),
    height: Math.max(MIN_WINDOW.height, Math.min(size.height, bounds.height)),
  };
}

/** Keeps a window's size within limits and enough of its title bar inside the desktop. */
export function clampRect(rect: Rect, bounds: Bounds): Rect {
  const { width, height } = clampSize(rect, bounds);
  return {
    width,
    height,
    x: clamp(rect.x, -(width - VISIBLE_GRIP), bounds.width - VISIBLE_GRIP),
    y: clamp(rect.y, 0, bounds.height - TITLE_BAR_HEIGHT),
  };
}

/** The id of the highest visible window, or null when none is visible. */
export function topVisibleId(windows: readonly ShellWindow[]): string | null {
  let top: ShellWindow | null = null;
  for (const w of windows) {
    if (!w.minimized && (!top || w.z > top.z)) top = w;
  }
  return top?.id ?? null;
}

function update(state: WindowState, id: string, change: (w: ShellWindow) => ShellWindow) {
  return { ...state, windows: state.windows.map((w) => (w.id === id ? change(w) : w)) };
}

function focus(state: WindowState, id: string): WindowState {
  const target = state.windows.find((w) => w.id === id);
  if (!target) return state;
  const isTop = target.z === state.nextZ - 1;
  if (state.focusedId === id && isTop && !target.minimized) return state;
  return {
    ...update(state, id, (w) => ({ ...w, z: state.nextZ, minimized: false })),
    focusedId: id,
    nextZ: state.nextZ + 1,
  };
}

function open(state: WindowState, action: Extract<WindowAction, { type: 'open' }>): WindowState {
  if (action.singleInstance) {
    const existing = state.windows.find((w) => w.appId === action.appId);
    if (existing) return focus(state, existing.id);
  }
  const size = clampSize(action.size, state.bounds);
  const offset = (state.windows.length % 5) * CASCADE_STEP;
  const rect = clampRect(
    {
      ...size,
      x: Math.round((state.bounds.width - size.width) / 2) + offset,
      y: Math.round((state.bounds.height - size.height) / 2) + offset,
    },
    state.bounds,
  );
  const window: ShellWindow = {
    id: `${action.appId}-${String(state.nextSeq)}`,
    appId: action.appId,
    rect,
    minimized: false,
    maximized: false,
    z: state.nextZ,
  };
  return {
    ...state,
    windows: [...state.windows, window],
    focusedId: window.id,
    nextZ: state.nextZ + 1,
    nextSeq: state.nextSeq + 1,
  };
}

function hide(state: WindowState, id: string, remove: boolean): WindowState {
  const windows = remove
    ? state.windows.filter((w) => w.id !== id)
    : state.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w));
  const focusedId = state.focusedId === id ? topVisibleId(windows) : state.focusedId;
  return { ...state, windows, focusedId };
}

export function windowReducer(state: WindowState, action: WindowAction): WindowState {
  switch (action.type) {
    case 'open':
      return open(state, action);
    case 'focus':
      return focus(state, action.id);
    case 'close':
      return hide(state, action.id, true);
    case 'toggleMinimize': {
      const target = state.windows.find((w) => w.id === action.id);
      if (!target) return state;
      return target.minimized ? focus(state, action.id) : hide(state, action.id, false);
    }
    case 'toggleMaximize':
      return focus(
        update(state, action.id, (w) => ({ ...w, maximized: !w.maximized })),
        action.id,
      );
    case 'move':
      return update(state, action.id, (w) => ({
        ...w,
        rect: clampRect({ ...w.rect, x: action.x, y: action.y }, state.bounds),
      }));
    case 'resize':
      return update(state, action.id, (w) => ({
        ...w,
        rect: clampRect({ ...w.rect, width: action.width, height: action.height }, state.bounds),
      }));
    case 'setBounds':
      return {
        ...state,
        bounds: action.bounds,
        windows: state.windows.map((w) => ({ ...w, rect: clampRect(w.rect, action.bounds) })),
      };
  }
}
