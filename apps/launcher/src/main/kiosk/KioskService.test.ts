import { defaultSettings, type KioskState, type Settings } from '@nextlevel/shared';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KioskService, RESET_FILE } from './KioskService.ts';
import { hashPin } from './pin.ts';

const MINUTE = 60_000;

function setup(kiosk: Partial<Settings['kiosk']> = {}) {
  let settings: Settings = { ...defaultSettings() };
  settings = { ...settings, kiosk: { ...settings.kiosk, ...kiosk } };
  let now = Date.UTC(2026, 10, 13, 12, 0, 0);
  const emitted: KioskState[] = [];
  const log = { info: vi.fn(), warn: vi.fn() };
  const service = new KioskService({
    settings: () => settings.kiosk,
    update: (change) => {
      settings = change(settings);
      return Promise.resolve();
    },
    clock: () => new Date(now),
    emit: (_event, state) => emitted.push(state),
    log,
  });
  return {
    service,
    emitted,
    log,
    advance: (ms: number) => (now += ms),
    current: () => settings.kiosk,
  };
}

const ALL = ['desktop', 'settings', 'themeSwitcher', 'catalog', 'account', 'quit'];

describe('KioskService (FR-SET-6, US-D4, D54)', () => {
  it('off by default: nothing is locked and every part is ticked to hide', () => {
    const { service } = setup();
    expect(service.state()).toEqual({
      enabled: false,
      locked: false,
      hide: ALL,
      retryAfterMs: 0,
    });
    expect(() => {
      service.guard('settings');
    }).not.toThrow();
  });

  it('enabled: locked at every start; the guard refuses only the hidden parts', async () => {
    const { service } = setup({
      enabled: true,
      pinHash: await hashPin('1234'),
      hide: ['settings', 'quit'],
    });
    expect(service.state()).toMatchObject({ enabled: true, locked: true });
    const refused = (() => {
      try {
        service.guard('settings');
        return null;
      } catch (error) {
        return error;
      }
    })();
    expect(refused).toMatchObject({ error: { code: 'KIOSK_LOCKED' } });
    expect(() => {
      service.guard('catalog');
    }).not.toThrow();
  });

  it('unlocked until restart; kiosk.lock locks again', async () => {
    const { service, emitted } = setup({ enabled: true, pinHash: await hashPin('1234') });
    expect(await service.unlock('1234')).toEqual({ ok: true });
    expect(service.state().locked).toBe(false);
    expect(() => {
      service.guard('quit');
    }).not.toThrow();
    service.lock();
    expect(service.state().locked).toBe(true);
    expect(emitted.map((state) => state.locked)).toEqual([false, true]);
  });

  it('5 wrong PINs → retryAfterMs 60000; a right PIN during the wait is refused', async () => {
    const { service, advance } = setup({ enabled: true, pinHash: await hashPin('1234') });
    for (let i = 0; i < 4; i += 1)
      expect(await service.unlock('9999')).toEqual({ ok: false, retryAfterMs: 0 });
    expect(await service.unlock('9999')).toEqual({ ok: false, retryAfterMs: MINUTE });
    expect(service.state().retryAfterMs).toBe(MINUTE);
    advance(30_000);
    expect(await service.unlock('1234')).toEqual({ ok: false, retryAfterMs: 30_000 });
    expect(service.state().locked).toBe(true);
    advance(30_000);
    expect(await service.unlock('1234')).toEqual({ ok: true });
  });

  it('configure: enabling needs a PIN; it is stored hashed; the PC stays unlocked until restart', async () => {
    const { service, current } = setup();
    await expect(service.configure({ enabled: true, hide: ['desktop'] })).rejects.toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
    await service.configure({ enabled: true, pin: '4821', hide: ['desktop'] });
    expect(current().enabled).toBe(true);
    expect(current().hide).toEqual(['desktop']);
    expect(current().pinHash).toMatch(/^scrypt\$/);
    expect(service.state().locked).toBe(false);
    // Changing the hidden parts later keeps the PIN.
    const hash = current().pinHash;
    await service.configure({ enabled: true, hide: ['desktop', 'quit'] });
    expect(current().pinHash).toBe(hash);
  });

  it('configure is refused while locked', async () => {
    const { service } = setup({ enabled: true, pinHash: await hashPin('1234') });
    await expect(service.configure({ enabled: false, hide: [] })).rejects.toMatchObject({
      error: { code: 'KIOSK_LOCKED' },
    });
  });

  describe('forgot the PIN', () => {
    let dir: string | null = null;
    afterEach(async () => {
      if (dir) await rm(dir, { recursive: true, force: true });
      dir = null;
    });

    it('reset-kiosk file next to the exe at boot → kiosk off, file deleted, logged', async () => {
      dir = await mkdtemp(join(tmpdir(), 'nextlevel-kiosk-'));
      await writeFile(join(dir, RESET_FILE), '');
      const { service, current, log } = setup({
        enabled: true,
        pinHash: await hashPin('1234'),
      });
      expect(await service.resetIfRequested(dir)).toBe(true);
      expect(current()).toMatchObject({ enabled: false, pinHash: null });
      expect(service.state().locked).toBe(false);
      expect(existsSync(join(dir, RESET_FILE))).toBe(false);
      expect(log.info).toHaveBeenCalled();
      expect(await service.resetIfRequested(dir)).toBe(false);
    });
  });
});
