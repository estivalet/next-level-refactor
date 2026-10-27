import { hostname } from 'node:os';
import type { DeviceInfo, Settings } from '@nextlevel/shared';
import { mainText } from '../i18n/mainText.ts';
import type { EmitEvent } from '../ipc/events.ts';
import type { SecretsLike } from '../secrets/SecretStore.ts';
import { ApiClient } from './ApiClient.ts';
import { apiBaseUrl } from './apiUrl.ts';
import { DISABLED_AUTH, type AuthApi } from './authHandlers.ts';
import { AuthService } from './AuthService.ts';
import { BillingService } from './BillingService.ts';
import { startLoopback } from './loopback.ts';

const DAY_MS = 24 * 3600_000;
const API_TIMEOUT_MS = 10_000;

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);

function platform(): DeviceInfo['platform'] {
  return process.platform === 'darwin' || process.platform === 'linux' ? process.platform : 'win32';
}

/** The development-only hooks (D25); a packaged build gets none of them. */
export function devHooks(
  isPackaged: boolean,
  env: Record<string, string | undefined>,
): {
  disabled: boolean;
  apiOverride: string | undefined;
  stubPersona: string | null;
  clockOffsetMs: number;
} {
  const dev = isPackaged ? {} : env;
  const days = Number(dev['NEXTLEVEL_E2E_CLOCK_OFFSET_DAYS'] ?? 0);
  return {
    disabled: dev['NEXTLEVEL_AUTH'] === 'off',
    apiOverride: dev['NEXTLEVEL_API_URL'],
    stubPersona: /^stub:(\w+)$/.exec(dev['NEXTLEVEL_E2E_BROWSER'] ?? '')?.[1] ?? null,
    clockOffsetMs: Number.isFinite(days) ? days * DAY_MS : 0,
  };
}

/**
 * Builds the launcher's sign-in (FR-AUTH-*). Development builds honour, for e2e and local work:
 * `NEXTLEVEL_AUTH=off` (no gate, D25), `NEXTLEVEL_API_URL`, `NEXTLEVEL_E2E_BROWSER=stub:<persona>`
 * (the "browser" fetches the stub's authorize URL, which redirects to the loopback) and
 * `NEXTLEVEL_E2E_CLOCK_OFFSET_DAYS`. Packaged builds ignore all of them.
 */
export function createAuth(opts: {
  isPackaged: boolean;
  env: Record<string, string | undefined>;
  builtApiUrl: string | undefined;
  secrets: SecretsLike;
  emit: EmitEvent;
  log: { warn(context: object, msg: string): void };
  appVersion: string;
  language: () => Settings['general']['language'];
  openExternal: (url: string) => Promise<void>;
}): { auth: AuthApi; start(): Promise<void>; dispose(): void } {
  const hooks = devHooks(opts.isPackaged, opts.env);
  if (hooks.disabled) {
    return { auth: DISABLED_AUTH, start: () => Promise.resolve(), dispose: () => undefined };
  }
  const baseUrl = apiBaseUrl({
    isPackaged: opts.isPackaged,
    override: hooks.apiOverride,
    built: opts.builtApiUrl,
  });
  const offsetMs = hooks.clockOffsetMs;
  const persona = hooks.stubPersona;
  const openBrowser = persona
    ? async (url: string) => {
        await fetch(`${url}&login_hint=${persona}`, { redirect: 'follow' });
      }
    : opts.openExternal;
  const api = new ApiClient({
    baseUrl,
    fetch: (input, init) => fetch(input, init),
    timeoutMs: API_TIMEOUT_MS,
  });
  const clock = () => new Date(Date.now() + offsetMs);
  const every = (ms: number, run: () => void) => {
    const timer = setInterval(run, ms);
    return () => {
      clearInterval(timer);
    };
  };
  const service = new AuthService({
    api,
    secrets: opts.secrets,
    openBrowser,
    loopback: startLoopback,
    device: () => ({
      name: hostname().slice(0, 100) || 'PC',
      platform: platform(),
      appVersion: opts.appVersion,
    }),
    page: (outcome) => {
      const text = escapeHtml(mainText(opts.language(), `auth.browser.${outcome}`));
      return `<!doctype html><meta charset="utf-8"><title>NextLevel</title><p style="font:16px sans-serif;margin:3em;text-align:center">${text}</p>`;
    },
    clock,
    every,
    emit: (state) => {
      opts.emit('auth.changed', state);
    },
    log: opts.log,
    apiOrigin: baseUrl,
    disabled: false,
  });
  // Checkout and the Portal always open in the real browser (the e2e pays through the API).
  const billing = new BillingService({
    auth: service,
    api,
    openBrowser: opts.openExternal,
    apiOrigin: baseUrl,
    every,
    clock,
    log: opts.log,
  });
  const auth: AuthApi = {
    state: () => service.state(),
    signIn: () => service.signIn(),
    cancelSignIn: () => service.cancelSignIn(),
    signOut: () => service.signOut(),
    refreshEntitlement: () => service.refreshEntitlement(),
    resolveDeviceLimit: (id) => service.resolveDeviceLimit(id),
    devices: () => service.devices(),
    revokeDevice: (id) => service.revokeDevice(id),
    plans: () => billing.plans(),
    openCheckout: (slug, interval) => billing.openCheckout(slug, interval),
    openPortal: () => billing.openPortal(),
    stopWaiting: () => billing.stopWaiting(),
  };
  return {
    auth,
    start: () => service.start(),
    dispose: () => {
      billing.dispose();
      service.dispose();
    },
  };
}
