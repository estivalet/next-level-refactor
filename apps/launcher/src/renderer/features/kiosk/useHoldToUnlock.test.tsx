import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHoldToUnlock } from './useHoldToUnlock.ts';

const key = (type: 'keydown' | 'keyup', code = 'Escape') => {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code }));
};

function pad(start: boolean) {
  const buttons = Array.from({ length: 17 }, (_, index) => ({ pressed: start && index === 9 }));
  return [{ mapping: 'standard', axes: [0, 0], buttons }];
}

describe('hold to unlock (US-D4, D54)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('FR-SET-6: the Esc hold is cancelled when the window loses focus', () => {
    const onHold = vi.fn();
    renderHook(() => {
      useHoldToUnlock({ enabled: true, onHold, getPads: () => [] });
    });
    key('keydown');
    vi.advanceTimersByTime(1000);
    // Alt+Tab away mid-hold: the keyup goes to another window.
    window.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(3000);
    expect(onHold).not.toHaveBeenCalled();
  });

  it('useHoldToUnlock: Esc held 3 s opens the PIN pad; released early does nothing', () => {
    const onHold = vi.fn();
    renderHook(() => {
      useHoldToUnlock({ enabled: true, onHold, getPads: () => [] });
    });
    key('keydown');
    vi.advanceTimersByTime(2000);
    key('keyup');
    vi.advanceTimersByTime(2000);
    expect(onHold).not.toHaveBeenCalled();
    key('keydown');
    // Auto-repeat keydowns while held don't restart the count.
    vi.advanceTimersByTime(1500);
    key('keydown');
    vi.advanceTimersByTime(1500);
    expect(onHold).toHaveBeenCalledTimes(1);
    key('keyup');
  });

  it('Start on a gamepad held 3 s opens the PIN pad, once per hold', () => {
    const onHold = vi.fn();
    let held = false;
    renderHook(() => {
      useHoldToUnlock({ enabled: true, onHold, getPads: () => pad(held) });
    });
    held = true;
    vi.advanceTimersByTime(1000);
    expect(onHold).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2200);
    expect(onHold).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(onHold).toHaveBeenCalledTimes(1);
    held = false;
    vi.advanceTimersByTime(200);
    held = true;
    vi.advanceTimersByTime(3200);
    expect(onHold).toHaveBeenCalledTimes(2);
  });

  it('does nothing while disabled (kiosk unlocked or off)', () => {
    const onHold = vi.fn();
    renderHook(() => {
      useHoldToUnlock({ enabled: false, onHold, getPads: () => pad(true) });
    });
    key('keydown');
    vi.advanceTimersByTime(4000);
    expect(onHold).not.toHaveBeenCalled();
  });
});
