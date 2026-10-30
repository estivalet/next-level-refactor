import type { Bounds, ShellWindow } from './windowManager.ts';

/** Height of the strip at the bottom of the desktop where the floating taskbar sits, margin included. */
export const DOCK_ZONE = 84;

/** True when a visible window reaches into the taskbar strip, so the taskbar should slide away. */
export function dockCovered(windows: readonly ShellWindow[], bounds: Bounds): boolean {
  const top = bounds.height - DOCK_ZONE;
  return windows.some(
    (win) => !win.minimized && (win.maximized || win.rect.y + win.rect.height > top),
  );
}
