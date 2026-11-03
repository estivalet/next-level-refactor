import { defaultSettings, type LaunchBoxStatus, type Settings } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { createLaunchBoxHandlers } from './launchboxHandlers.ts';

const READY: LaunchBoxStatus = {
  state: 'ready',
  builtAt: '2026-11-02T08:00:00.000Z',
  games: 3,
  progress: null,
  error: null,
};

function setup() {
  let settings = defaultSettings();
  const calls: string[] = [];
  const handlers = createLaunchBoxHandlers({
    service: () => ({
      status: () => READY,
      refresh: () => {
        calls.push('refresh');
        return { ...READY, state: 'downloading', progress: 0 };
      },
      cancel: () => {
        calls.push('cancel');
        return READY;
      },
      index: () => ({ platforms: () => ['Microsoft Xbox 360', 'Nintendo DS'] }),
    }),
    updateSettings: (change: (current: Settings) => Settings) => {
      settings = change(settings);
      return Promise.resolve();
    },
    systemExists: (systemId) => systemId === 'snes',
  });
  return { handlers, calls, settings: () => settings };
}

describe('LaunchBox handlers (FR-SCR-6)', () => {
  it('status, refresh, cancel and platforms reach the service', async () => {
    const { handlers, calls } = setup();
    expect(await handlers['launchbox.status']()).toEqual(READY);
    expect((await handlers['launchbox.refresh']()).state).toBe('downloading');
    await handlers['launchbox.cancel']();
    expect(calls).toEqual(['refresh', 'cancel']);
    expect(await handlers['launchbox.platforms']()).toEqual(['Microsoft Xbox 360', 'Nintendo DS']);
  });

  it('setPlatform stores the override for a known system only', async () => {
    const { handlers, settings } = setup();
    await handlers['launchbox.setPlatform']({
      systemId: 'snes',
      platform: 'Super Nintendo Entertainment System',
    });
    expect(settings().systems['snes']?.launchboxPlatform).toBe(
      'Super Nintendo Entertainment System',
    );
    await expect(
      handlers['launchbox.setPlatform']({ systemId: 'nope', platform: 'X' }),
    ).rejects.toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
