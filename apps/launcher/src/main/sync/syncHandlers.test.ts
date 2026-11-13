import { describe, expect, it, vi } from 'vitest';
import { KIOSK_GUARDED } from '../kiosk/kioskGuards.ts';
import { createSyncHandlers } from './syncHandlers.ts';

const on = { enabled: true, lastSync: null, syncing: false, error: null };

describe('sync handlers (FR-SET-5, D55)', () => {
  it('pass state, setEnabled, now and deleteRemote through to the service', async () => {
    const service = {
      state: vi.fn(() => on),
      setEnabled: vi.fn(() => Promise.resolve(on)),
      sync: vi.fn(() => Promise.resolve(on)),
      deleteRemote: vi.fn(() => Promise.resolve({ ...on, enabled: false })),
    };
    const handlers = createSyncHandlers(service);
    expect(await handlers['sync.state']()).toEqual(on);
    await handlers['sync.setEnabled']({ enabled: true });
    expect(service.setEnabled).toHaveBeenCalledWith(true);
    await handlers['sync.now']();
    expect(service.sync).toHaveBeenCalledTimes(1);
    expect((await handlers['sync.deleteRemote']()).enabled).toBe(false);
  });

  it('without sign-in (development) sync is off and cannot be turned on', async () => {
    const handlers = createSyncHandlers(undefined);
    const off = { enabled: false, lastSync: null, syncing: false, error: null };
    expect(await handlers['sync.state']()).toEqual(off);
    expect(await handlers['sync.setEnabled']({ enabled: true })).toEqual(off);
  });

  it('a locked kiosk refuses Settings → Sync', () => {
    expect(KIOSK_GUARDED['sync.setEnabled']).toBe('settings');
    expect(KIOSK_GUARDED['sync.now']).toBe('settings');
    expect(KIOSK_GUARDED['sync.deleteRemote']).toBe('settings');
  });
});
