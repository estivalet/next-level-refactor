import { describe, expect, it, vi } from 'vitest';
import { createKioskHandlers } from './kioskHandlers.ts';

describe('kiosk handlers (FR-SET-6)', () => {
  it('pass state, unlock, lock and configure through to the service', async () => {
    const state = { enabled: true, locked: true, hide: [], retryAfterMs: 0 };
    const service = {
      state: vi.fn(() => state),
      unlock: vi.fn(() => Promise.resolve({ ok: true as const })),
      lock: vi.fn(() => state),
      configure: vi.fn(() => Promise.resolve(state)),
    };
    const handlers = createKioskHandlers(service);
    expect(await handlers['kiosk.state']()).toBe(state);
    expect(await handlers['kiosk.unlock']({ pin: '1234' })).toEqual({ ok: true });
    expect(service.unlock).toHaveBeenCalledWith('1234');
    expect(await handlers['kiosk.lock']()).toBe(state);
    await handlers['kiosk.configure']({ enabled: true, pin: '1234', hide: ['quit'] });
    expect(service.configure).toHaveBeenCalledWith({ enabled: true, pin: '1234', hide: ['quit'] });
  });

  it('without a kiosk service (tests that do not wire it) kiosk is off', async () => {
    const handlers = createKioskHandlers(undefined);
    expect(await handlers['kiosk.state']()).toEqual({
      enabled: false,
      locked: false,
      hide: [],
      retryAfterMs: 0,
    });
  });
});
