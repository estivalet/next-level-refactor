import { describe, expect, it, vi } from 'vitest';
import { createUpdateHandlers } from './updateHandlers.ts';

describe('update handlers (NFR-UPD-1)', () => {
  it('pass state, check and restart through to the service', async () => {
    const service = {
      state: vi.fn(() => ({ kind: 'idle' as const, lastCheck: null })),
      check: vi.fn(() => Promise.resolve({ kind: 'checking' as const })),
      restart: vi.fn(),
    };
    const handlers = createUpdateHandlers(service);
    expect(await handlers['update.state']()).toEqual({ kind: 'idle', lastCheck: null });
    expect(await handlers['update.check']()).toEqual({ kind: 'checking' });
    await handlers['update.restart']();
    expect(service.restart).toHaveBeenCalledTimes(1);
  });

  it('without an update service (not wired) the launcher reports a development build', async () => {
    const handlers = createUpdateHandlers(undefined);
    const dev = { kind: 'unsupported', reason: 'dev', availableVersion: null, releaseUrl: null };
    expect(await handlers['update.state']()).toEqual(dev);
    expect(await handlers['update.check']()).toEqual(dev);
    // Nothing to restart into: the call settles without throwing.
    await expect(Promise.resolve(handlers['update.restart']())).resolves.toBeUndefined();
  });
});
