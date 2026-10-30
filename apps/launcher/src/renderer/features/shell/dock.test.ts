import { describe, expect, it } from 'vitest';
import { DOCK_ZONE, dockCovered } from './dock.ts';
import type { ShellWindow } from './windowManager.ts';

const BOUNDS = { width: 1200, height: 800 };

function win(change: Partial<ShellWindow> = {}): ShellWindow {
  return {
    id: 'w-1',
    appId: 'settings',
    rect: { x: 100, y: 100, width: 600, height: 400 },
    minimized: false,
    maximized: false,
    z: 1,
    ...change,
  };
}

describe('dockCovered', () => {
  it('is false with no windows or windows clear of the dock strip', () => {
    expect(dockCovered([], BOUNDS)).toBe(false);
    const bottom = BOUNDS.height - DOCK_ZONE;
    expect(
      dockCovered([win({ rect: { x: 0, y: bottom - 400, width: 600, height: 400 } })], BOUNDS),
    ).toBe(false);
  });

  it('is true when a window reaches into the dock strip or is maximized', () => {
    const bottom = BOUNDS.height - DOCK_ZONE;
    expect(
      dockCovered([win({ rect: { x: 0, y: bottom - 399, width: 600, height: 400 } })], BOUNDS),
    ).toBe(true);
    expect(dockCovered([win({ maximized: true })], BOUNDS)).toBe(true);
  });

  it('ignores minimized windows', () => {
    expect(dockCovered([win({ minimized: true, maximized: true })], BOUNDS)).toBe(false);
  });
});
