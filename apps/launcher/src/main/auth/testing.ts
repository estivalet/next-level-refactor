import type {
  AuthState,
  Device,
  Entitlement,
  EntitlementResponse,
  SessionRecord,
  SessionResponse,
  UserProfile,
} from '@nextlevel/shared';
import { memorySecrets } from '../secrets/testing.ts';
import { ApiFailure, type Failure } from './ApiClient.ts';
import { AuthService, type AuthDeps } from './AuthService.ts';
import type { LoopbackResult } from './loopback.ts';

export const DAY = 24 * 3600_000;
export const T0 = Date.parse('2026-10-25T12:00:00.000Z');

export const USER: UserProfile = {
  id: 'u1',
  email: 'p@example.test',
  name: 'Player',
  avatarUrl: null,
  role: 'subscriber',
};

export function entitlement(at: number, overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    userId: 'u1',
    role: 'subscriber',
    status: 'active',
    plan: { slug: 'default', name: 'Default', deviceLimit: 3 },
    scopes: [],
    checkedAt: new Date(at).toISOString(),
    offlineUntil: new Date(at + 14 * DAY).toISOString(),
    ...overrides,
  };
}

export const device = (id: string, current = false): Device => ({
  id,
  name: `PC ${id}`,
  platform: 'win32',
  appVersion: '0.7.0',
  createdAt: new Date(T0).toISOString(),
  lastSeenAt: new Date(T0).toISOString(),
  revokedAt: null,
  current,
});

export const storedSession = (at: number, overrides: Partial<SessionRecord> = {}) =>
  JSON.stringify({
    deviceId: 'd1',
    refreshToken: 'r0',
    user: USER,
    entitlement: entitlement(at),
    localCheckedAt: new Date(at).toISOString(),
    ...overrides,
  } satisfies SessionRecord);

/** A value, an API failure, or a call that answers when the test says (races). */
type Step<T> = T | Failure | (() => Promise<T>);
const answer = <T>(step: Step<T> | undefined, fallback: () => T): Promise<T> => {
  if (step === undefined) return Promise.resolve(fallback());
  if (typeof step === 'function') return (step as () => Promise<T>)();
  if (typeof step === 'object' && step !== null && 'kind' in step) {
    return Promise.reject(new ApiFailure(step));
  }
  return Promise.resolve(step as T);
};

/** A scripted API: each call takes the next step of its queue, else a good default answer. */
export function fakeApi(now: () => number) {
  const calls: string[] = [];
  let n = 0;
  const queues = {
    config: [] as Step<{
      authorizeUrl: string;
      clientId: string;
      scopes: string[];
      banner: string | null;
    }>[],
    exchange: [] as Step<SessionResponse>[],
    complete: [] as Step<SessionResponse>[],
    refresh: [] as Step<{ accessToken: string; refreshToken: string }>[],
    entitlement: [] as Step<EntitlementResponse>[],
    devices: [] as Step<Device[]>[],
  };
  const session = (): SessionResponse => ({
    accessToken: 'a-new',
    refreshToken: 'r-new',
    deviceId: 'd1',
    user: USER,
    entitlement: entitlement(now()),
    banner: null,
  });
  const api = {
    launcherConfig: () => {
      calls.push('config');
      return answer(queues.config.shift(), () => ({
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        clientId: 'cid',
        scopes: ['openid', 'email', 'profile'],
        banner: null,
      }));
    },
    exchange: (body: unknown) => {
      calls.push(`exchange:${JSON.stringify(body)}`);
      return answer(queues.exchange.shift(), session);
    },
    complete: (body: { revokeDeviceId: string }) => {
      calls.push(`complete:${body.revokeDeviceId}`);
      return answer(queues.complete.shift(), session);
    },
    refresh: (body: { refreshToken: string }) => {
      calls.push(`refresh:${body.refreshToken}`);
      n += 1;
      return answer(queues.refresh.shift(), () => ({
        accessToken: `a${String(n)}`,
        refreshToken: `r${String(n)}`,
      }));
    },
    logout: (token: string) => {
      calls.push(`logout:${token}`);
      return Promise.resolve();
    },
    entitlement: (access: string) => {
      calls.push(`entitlement:${access}`);
      return answer(queues.entitlement.shift(), () => ({
        entitlement: entitlement(now()),
        banner: null,
      }));
    },
    devices: (access: string) => {
      calls.push(`devices:${access}`);
      return answer(queues.devices.shift(), () => [device('d1', true), device('d2')]);
    },
    revokeDevice: (access: string, id: string) => {
      calls.push(`revoke:${access}:${id}`);
      return Promise.resolve();
    },
  };
  return { api, calls, queues };
}

/** An AuthService on fakes; `browse(result)` answers the pending browser sign-in. */
export function setup(
  opts: {
    session?: string;
    secretsAvailable?: boolean;
    disabled?: boolean;
    loopbackFails?: boolean;
  } = {},
) {
  let now = T0;
  const clock = () => new Date(now);
  const { api, calls, queues } = fakeApi(() => now);
  const secrets = memorySecrets(
    opts.session ? { 'auth.session': opts.session } : {},
    opts.secretsAvailable ?? true,
  );
  const states: AuthState[] = [];
  const opened: string[] = [];
  let pending: ((result: LoopbackResult) => void) | null = null;
  let tick: (() => void) | null = null;
  const deps: AuthDeps = {
    api,
    secrets,
    openBrowser: (url) => {
      opened.push(url);
      return Promise.resolve();
    },
    loopback: () => {
      if (opts.loopbackFails) return Promise.reject(new Error('EACCES'));
      const result = new Promise<LoopbackResult>((resolve) => {
        pending = resolve;
      });
      return Promise.resolve({
        redirectUri: 'http://127.0.0.1:5555/callback',
        result,
        close: () => {
          pending?.({ cancelled: true });
        },
      });
    },
    pkce: () => ({ verifier: 'v'.repeat(64), challenge: 'chal', state: 'st' }),
    device: () => ({ name: 'Living room', platform: 'win32', appVersion: '0.7.0' }),
    page: () => '',
    clock,
    every: (_ms, run) => {
      tick = run;
      return () => {
        tick = null;
      };
    },
    emit: (state) => {
      states.push(state);
    },
    log: { warn: () => undefined },
    apiOrigin: 'http://localhost:4000',
    disabled: opts.disabled ?? false,
  };
  const service = new AuthService(deps);
  return {
    service,
    calls,
    queues,
    secrets,
    states,
    opened,
    advance: (ms: number) => {
      now += ms;
    },
    setNow: (at: number) => {
      now = at;
    },
    tick: () => tick?.(),
    /** Resolves the browser wait once the service is waiting on it. */
    browse: async (result: LoopbackResult) => {
      for (let i = 0; i < 50 && !pending; i += 1) await Promise.resolve();
      pending?.(result);
      pending = null;
    },
    stored: async () => {
      const raw = await secrets.get('auth.session');
      return raw === null ? null : (JSON.parse(raw) as SessionRecord);
    },
  };
}

/** A call the test answers later: `step` goes in a queue, `release` answers it. */
export function held<T>(value: T) {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { step: () => gate.then(() => value), release };
}
