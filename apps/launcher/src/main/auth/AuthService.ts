import {
  AppErrorException,
  DeviceLimitDetailsSchema,
  ERROR_CODES,
  SessionRecordSchema,
  type AuthState,
  type Device,
  type DeviceInfo,
  type SessionRecord,
  type SessionResponse,
  type SignedOutReason,
} from '@nextlevel/shared';
import type { SecretsLike } from '../secrets/SecretStore.ts';
import { ApiFailure, type ApiClient } from './ApiClient.ts';
import type { startLoopback } from './loopback.ts';
import { createPkce } from './pkce.ts';
import { authorizeUrlAllowed, offlineAllowed } from './rules.ts';

export const CHECK_EVERY_MS = 60 * 60_000;
const BROWSER_WAIT_MS = 5 * 60_000;
/** Access tokens live 15 minutes; renew a little before. */
const ACCESS_FRESH_MS = 13 * 60_000;

export interface AuthDeps {
  api: Pick<
    ApiClient,
    | 'launcherConfig'
    | 'exchange'
    | 'complete'
    | 'refresh'
    | 'logout'
    | 'entitlement'
    | 'devices'
    | 'revokeDevice'
  >;
  secrets: SecretsLike;
  openBrowser: (url: string) => Promise<void>;
  loopback: typeof startLoopback;
  pkce?: typeof createPkce;
  device: () => DeviceInfo;
  /** The page the browser shows after the callback. */
  page: (outcome: 'ok' | 'cancelled') => string;
  clock: () => Date;
  /** Runs `run` every `ms`; returns a stop function. */
  every: (ms: number, run: () => void) => () => void;
  emit: (state: AuthState) => void;
  log: { warn(context: object, msg: string): void };
  /** The API's origin: the only place besides Google the browser may be sent. */
  apiOrigin: string;
  /** `NEXTLEVEL_AUTH=off` (development builds only, D25). */
  disabled: boolean;
}

const failureOf = (error: unknown) => (error instanceof ApiFailure ? error.failure : null);
const unreachable = () =>
  new AppErrorException({ code: 'API_UNREACHABLE', message: ERROR_CODES.API_UNREACHABLE });

/**
 * The launcher's sign-in (ADR-006, IA F1/F2): browser + PKCE + loopback, the session in the OS
 * store, an hourly entitlement check, and the offline grace (FR-AUTH-5). Access tokens stay in
 * memory; refreshes are single-flight, because presenting a rotated refresh token twice revokes
 * the device.
 */
export class AuthService {
  readonly #deps: AuthDeps;
  #state: AuthState = { kind: 'checking' };
  #session: SessionRecord | null = null;
  #access: { token: string; at: number } | null = null;
  #remembered = true;
  #banner: string | null = null;
  #refreshing: Promise<void> | null = null;
  #checking: Promise<AuthState> | null = null;
  #signIn: { close(): void } | null = null;
  #ticket: string | null = null;
  #cancelRequested = false;
  /**
   * Bumped whenever the session is replaced or removed (sign-in, sign-out, revoke): work that
   * started on an older session never stores or announces anything (a sign-out stays a sign-out).
   */
  #generation = 0;
  #stopTimer: (() => void) | null = null;

  constructor(deps: AuthDeps) {
    this.#deps = deps;
    if (deps.disabled) this.#state = { kind: 'disabled' };
  }

  state(): AuthState {
    return this.#state;
  }

  /** Boot routing (F2): a stored session is checked online, else judged by the grace. */
  async start(): Promise<void> {
    if (this.#deps.disabled) return;
    this.#stopTimer = this.#deps.every(CHECK_EVERY_MS, () => {
      if (this.#state.kind === 'signedIn') void this.refreshEntitlement();
    });
    this.#session = await this.#load();
    if (this.#session) await this.refreshEntitlement();
    else await this.#signedOut(null);
  }

  /** Resolves when no check is running (tests). */
  async idle(): Promise<void> {
    while (this.#checking) await this.#checking;
  }

  refreshEntitlement(): Promise<AuthState> {
    if (this.#deps.disabled || !this.#session) return Promise.resolve(this.#state);
    this.#checking ??= this.#check().finally(() => {
      this.#checking = null;
    });
    return this.#checking;
  }

  async signIn(): Promise<AuthState> {
    if (this.#deps.disabled || this.#state.kind === 'signingIn') return this.#state;
    // A kept session (offline past the grace, US-A3) reconnects without the browser.
    if (this.#session) {
      const state = await this.refreshEntitlement();
      if (this.#hasSession()) return state;
    }
    this.#cancelRequested = false;
    this.#set({ kind: 'signingIn' });
    try {
      return await this.#browserSignIn();
    } catch (error) {
      this.#signIn?.close();
      this.#signIn = null;
      this.#deps.log.warn({ error }, 'sign-in failed');
      return this.#signedOut('error');
    }
  }

  async #browserSignIn(): Promise<AuthState> {
    let config;
    try {
      config = await this.#deps.api.launcherConfig();
    } catch {
      return this.#signedOut('unreachable');
    }
    this.#banner = config.banner;
    if (this.#cancelled()) return this.#signedOut('cancelled');
    if (!authorizeUrlAllowed(config.authorizeUrl, this.#deps.apiOrigin)) {
      this.#deps.log.warn({}, 'sign-in refused: unexpected authorize URL');
      return this.#signedOut('error');
    }
    const pkce = (this.#deps.pkce ?? createPkce)();
    const loop = await this.#deps.loopback({
      state: pkce.state,
      timeoutMs: BROWSER_WAIT_MS,
      page: this.#deps.page,
    });
    this.#signIn = loop;
    if (this.#cancelled()) loop.close();
    const url = new URL(config.authorizeUrl);
    for (const [key, value] of Object.entries({
      client_id: config.clientId,
      redirect_uri: loop.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
      state: pkce.state,
      prompt: 'select_account',
    })) {
      url.searchParams.set(key, value);
    }
    if (!this.#cancelled()) await this.#deps.openBrowser(url.toString());
    const result = await loop.result;
    this.#signIn = null;
    if ('cancelled' in result) return this.#signedOut('cancelled');
    if ('timeout' in result) return this.#signedOut('timeout');
    return this.#finish(() =>
      this.#deps.api.exchange({
        code: result.code,
        codeVerifier: pkce.verifier,
        redirectUri: loop.redirectUri,
        device: this.#deps.device(),
      }),
    );
  }

  // Read through methods: these fields change while a sign-in awaits.
  #hasSession(): boolean {
    return this.#session !== null;
  }

  #cancelled(): boolean {
    return this.#cancelRequested;
  }

  cancelSignIn(): AuthState {
    if (this.#state.kind === 'signingIn') this.#cancelRequested = true;
    this.#signIn?.close();
    return this.#state;
  }

  resolveDeviceLimit(revokeDeviceId: string): Promise<AuthState> {
    const ticket = this.#ticket;
    if (this.#state.kind !== 'deviceLimit' || !ticket) return Promise.resolve(this.#state);
    return this.#finish(() =>
      this.#deps.api.complete({ ticket, revokeDeviceId, device: this.#deps.device() }),
    );
  }

  async signOut(): Promise<AuthState> {
    const session = this.#session;
    if (this.#deps.disabled) return this.#state;
    if (session) {
      // The device slot is freed when the API hears it; offline, the tokens still go (FR-AUTH-6).
      await this.#deps.api.logout(session.refreshToken).catch(() => undefined);
    }
    await this.#clear();
    return this.#signedOut(null);
  }

  devices(): Promise<Device[]> {
    return this.#withAccess((token) => this.#deps.api.devices(token));
  }

  async revokeDevice(deviceId: string): Promise<Device[]> {
    await this.#withAccess((token) => this.#deps.api.revokeDevice(token, deviceId));
    return this.devices();
  }

  dispose(): void {
    this.#stopTimer?.();
    this.#signIn?.close();
  }

  async #check(): Promise<AuthState> {
    const session = this.#session;
    if (!session) return this.#state;
    const generation = this.#generation;
    try {
      await this.#refresh();
      const token = this.#access?.token ?? '';
      const answer = await this.#deps.api.entitlement(token);
      if (generation !== this.#generation) return this.#state;
      this.#banner = answer.banner;
      await this.#store({
        ...session,
        refreshToken: this.#session?.refreshToken ?? session.refreshToken,
        entitlement: answer.entitlement,
        localCheckedAt: this.#deps.clock().toISOString(),
      });
      return this.#signedIn(false);
    } catch (error) {
      if (generation !== this.#generation) return this.#state;
      const failure = failureOf(error);
      if (failure?.kind === 'api' && failure.status === 401) {
        await this.#clear();
        return this.#signedOut('revoked');
      }
      if (failure === null) this.#deps.log.warn({ error }, 'entitlement check failed');
      const current = this.#session;
      if (current && offlineAllowed(current, this.#deps.clock())) return this.#signedIn(true);
      // The session stays: reconnecting signs back in without the browser (US-A3).
      return this.#signedOut('offlineExpired');
    }
  }

  /** One refresh at a time; the rotated token is stored before anything else uses it. */
  #refresh(): Promise<void> {
    this.#refreshing ??= (async () => {
      const session = this.#session;
      if (!session) throw new Error('no session');
      const generation = this.#generation;
      const pair = await this.#deps.api.refresh({
        refreshToken: session.refreshToken,
        deviceId: session.deviceId,
      });
      if (generation !== this.#generation) throw new Error('signed out meanwhile');
      this.#access = { token: pair.accessToken, at: this.#deps.clock().getTime() };
      await this.#store({ ...session, refreshToken: pair.refreshToken });
    })().finally(() => {
      this.#refreshing = null;
    });
    return this.#refreshing;
  }

  async #withAccess<T>(call: (token: string) => Promise<T>): Promise<T> {
    if (!this.#session) throw unreachable();
    try {
      const access = this.#access;
      if (!access || this.#deps.clock().getTime() - access.at > ACCESS_FRESH_MS) {
        await this.#refresh();
      }
      return await call(this.#access?.token ?? '');
    } catch (error) {
      const failure = failureOf(error);
      if (failure?.kind === 'api' && failure.status === 401) {
        await this.#clear();
        await this.#signedOut('revoked');
      }
      if (failure?.kind === 'api') {
        throw new AppErrorException({ code: failure.code, message: ERROR_CODES[failure.code] });
      }
      throw unreachable();
    }
  }

  async #finish(call: () => Promise<SessionResponse>): Promise<AuthState> {
    let session: SessionResponse;
    try {
      session = await call();
    } catch (error) {
      const failure = failureOf(error);
      if (failure?.kind === 'offline') return this.#signedOut('unreachable');
      if (failure?.code === 'NOT_ALLOWED') return this.#signedOut('notAllowed');
      if (failure?.code === 'DEVICE_LIMIT') {
        const details = DeviceLimitDetailsSchema.safeParse(failure.details);
        if (details.success) {
          this.#ticket = details.data.ticket;
          return this.#set({ kind: 'deviceLimit', devices: details.data.devices });
        }
      }
      return this.#signedOut('error');
    }
    this.#ticket = null;
    this.#generation += 1;
    this.#banner = session.banner;
    this.#access = { token: session.accessToken, at: this.#deps.clock().getTime() };
    this.#remembered = await this.#deps.secrets.available().catch(() => false);
    await this.#store({
      deviceId: session.deviceId,
      refreshToken: session.refreshToken,
      user: session.user,
      entitlement: session.entitlement,
      localCheckedAt: this.#deps.clock().toISOString(),
    });
    return this.#signedIn(false);
  }

  async #load(): Promise<SessionRecord | null> {
    try {
      const raw = await this.#deps.secrets.get('auth.session');
      if (raw === null) return null;
      const parsed = SessionRecordSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  /** Keeps the session in memory, and in the OS store when it is available. */
  async #store(session: SessionRecord): Promise<void> {
    this.#session = session;
    if (!this.#remembered) return;
    try {
      await this.#deps.secrets.setMany({ 'auth.session': JSON.stringify(session) });
    } catch (error) {
      this.#remembered = false;
      this.#deps.log.warn({ code: (error as { code?: string }).code }, 'sign-in not remembered');
    }
  }

  async #clear(): Promise<void> {
    this.#generation += 1;
    this.#session = null;
    this.#access = null;
    await this.#deps.secrets.setMany({ 'auth.session': null }).catch(() => undefined);
  }

  #signedIn(offline: boolean): AuthState {
    const session = this.#session;
    if (!session) return this.#state;
    return this.#set({
      kind: 'signedIn',
      user: session.user,
      entitlement: session.entitlement,
      offline,
      banner: this.#banner,
      remembered: this.#remembered,
    });
  }

  async #signedOut(reason: SignedOutReason | null): Promise<AuthState> {
    if (reason === null && this.#banner === null) {
      this.#banner = await this.#deps.api.launcherConfig().then(
        (config) => config.banner,
        () => null,
      );
    }
    return this.#set({ kind: 'signedOut', reason, banner: this.#banner });
  }

  #set(state: AuthState): AuthState {
    this.#state = state;
    this.#deps.emit(state);
    return state;
  }
}
