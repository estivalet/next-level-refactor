import { AppErrorException, ERROR_CODES } from '@nextlevel/shared';
import { describe, expect, it, vi } from 'vitest';
import { createCloseGuard } from './closeGuard.ts';

const refuse = () => {
  throw new AppErrorException({ code: 'KIOSK_LOCKED', message: ERROR_CODES.KIOSK_LOCKED });
};

describe('window close in kiosk mode (FR-SET-6, D54)', () => {
  it('locked with Quit hidden: the title-bar X and Alt+F4 are refused', () => {
    const event = { preventDefault: vi.fn() };
    createCloseGuard({ guard: refuse, quitting: () => false })(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('a quit NextLevel started itself (app.quit, update install, test harness) goes through', () => {
    const event = { preventDefault: vi.fn() };
    createCloseGuard({ guard: refuse, quitting: () => true })(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('unlocked or Quit not hidden: closing works', () => {
    const event = { preventDefault: vi.fn() };
    createCloseGuard({ guard: () => undefined, quitting: () => false })(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
