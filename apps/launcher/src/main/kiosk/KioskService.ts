import {
  AppErrorException,
  ERROR_CODES,
  type KioskHide,
  type KioskState,
  type KioskUnlockResult,
  type Settings,
} from '@nextlevel/shared';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { hashPin, verifyPin } from './pin.ts';

/** Forgot the PIN (D54): an empty file with this name next to NextLevel.exe turns kiosk off. */
export const RESET_FILE = 'reset-kiosk';

const MAX_TRIES = 5;
const WAIT_MS = 60_000;

type KioskSettings = Settings['kiosk'];

export interface KioskServiceDeps {
  settings: () => KioskSettings;
  /** A main-side settings write (the kiosk section is main-owned). */
  update: (change: (settings: Settings) => Settings) => Promise<void>;
  clock: () => Date;
  emit: (event: 'kiosk.changed', state: KioskState) => void;
  log: { info(context: object, message: string): void };
}

const fail = (code: 'KIOSK_LOCKED' | 'VALIDATION_FAILED', details?: unknown): never => {
  throw new AppErrorException({ code, message: ERROR_CODES[code], details });
};

/**
 * Kiosk mode (FR-SET-6, US-D4, D54). The lock lives in main's memory only: an enabled kiosk is
 * locked at every start, and the PIN unlocks it until restart or Lock now. Five wrong PINs make
 * the next try wait a minute. `guard` is what IPC handlers call, so hidden parts are refused in
 * main, not just hidden in the renderer.
 */
export class KioskService {
  private locked = true;
  private wrong = 0;
  private waitUntil = 0;

  constructor(private readonly deps: KioskServiceDeps) {}

  state(): KioskState {
    const { enabled, hide } = this.deps.settings();
    return {
      enabled,
      locked: enabled && this.locked,
      hide: [...hide],
      retryAfterMs: Math.max(0, this.waitUntil - this.deps.clock().getTime()),
    };
  }

  /** Throws KIOSK_LOCKED when kiosk is locked and hides `part`. */
  guard(part: KioskHide): void {
    const state = this.state();
    if (state.locked && state.hide.includes(part)) fail('KIOSK_LOCKED', { part });
  }

  async unlock(pin: string): Promise<KioskUnlockResult> {
    const wait = this.state().retryAfterMs;
    if (wait > 0) return { ok: false, retryAfterMs: wait };
    const { pinHash } = this.deps.settings();
    if (pinHash && (await verifyPin(pin, pinHash))) {
      this.wrong = 0;
      this.setLocked(false);
      return { ok: true };
    }
    this.wrong += 1;
    if (this.wrong >= MAX_TRIES) {
      this.wrong = 0;
      this.waitUntil = this.deps.clock().getTime() + WAIT_MS;
    }
    return { ok: false, retryAfterMs: this.state().retryAfterMs };
  }

  lock(): KioskState {
    this.setLocked(true);
    return this.state();
  }

  /** Settings → Kiosk, unlocked only. Turning kiosk on keeps this PC unlocked until restart. */
  async configure(input: { enabled: boolean; pin?: string | undefined; hide: KioskHide[] }) {
    if (this.state().locked) fail('KIOSK_LOCKED');
    const current = this.deps.settings();
    if (input.enabled && !input.pin && !current.pinHash)
      fail('VALIDATION_FAILED', { pin: 'required' });
    const pinHash = input.pin ? await hashPin(input.pin) : current.pinHash;
    await this.deps.update((settings) => ({
      ...settings,
      kiosk: { enabled: input.enabled, pinHash, hide: [...new Set(input.hide)] },
    }));
    this.setLocked(false);
    return this.state();
  }

  /** At boot: `reset-kiosk` next to the exe turns kiosk off and forgets the PIN (D54). */
  async resetIfRequested(root: string): Promise<boolean> {
    const file = join(root, RESET_FILE);
    if (!existsSync(file)) return false;
    await this.deps.update((settings) => ({
      ...settings,
      kiosk: { ...settings.kiosk, enabled: false, pinHash: null },
    }));
    rmSync(file, { force: true });
    this.deps.log.info({ file }, 'kiosk turned off by the reset-kiosk file');
    this.setLocked(false);
    return true;
  }

  private setLocked(locked: boolean): void {
    this.locked = locked;
    this.deps.emit('kiosk.changed', this.state());
  }
}
