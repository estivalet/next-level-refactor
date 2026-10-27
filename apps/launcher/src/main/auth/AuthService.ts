import {
  AppErrorException,
  DeviceLimitDetailsSchema,
  ERROR_CODES,
  type AuthState,
  type Device,
  type DeviceInfo,
  type SessionResponse,
  type SignedOutReason,
} from '@nextlevel/shared';
import type { SecretsLike } from '../secrets/SecretStore.ts';
import { AccessTokens } from './AccessTokens.ts';
import { ApiFailure, type ApiClient } from './ApiClient.ts';
import { browserSignIn } from './browserSignIn.ts';
import type { startLoopback } from './loopback.ts';
import type { createPkce } from './pkce.ts';
import { offlineAllowed } from './rules.ts';
import { SessionVault } from './SessionVault.ts';

export const CHECK_EVERY_MS = 60 * 60_000;

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
    | 'deleteAccount'
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
  readonly #vault: SessionVault;
  readonly #tokens: AccessTokens;
  #state: AuthState = { kind: 'checking' };
  #banner: string | null = null;
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
  /** Checkout is open and BillingService is polling (IA F7). */
  #waiting = false;

  constructor(deps: AuthDeps) {
    this.#deps = deps;
    this.#vault = new SessionVault(deps.secrets, deps.log);
    this.#tokens = new AccessTokens({
      api: deps.api,
      vault: this.#vault,
      clock: deps.clock,
      generation: () => this.#generation,
    });
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
    if (await this.#vault.load()) await this.refreshEntitlement();
    else await this.#signedOut(null);
  }

  /** Resolves when no check is running (tests). */
  async idle(): Promise<void> {
    while (this.#checking) await this.#checking;
  }

  refreshEntitlement(): Promise<AuthState> {
    if (this.#deps.disabled || !this.#hasSession()) return Promise.resolve(this.#state);
    this.#checking ??= this.#check().finally(() => {
      this.#checking = null;
    });
    return this.#checking;
  }

  async signIn(): Promise<AuthState> {
    if (this.#deps.disabled || this.#state.kind === 'signingIn') return this.#state;
    // A kept session (offline past the grace, US-A3) reconnects without the browser.
    if (this.#hasSession()) {
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
    const result = await browserSignIn(this.#deps, {
      cancelled: () => this.#cancelled(),
      onLoop: (loop) => {
        this.#signIn = loop;
      },
      onBanner: (banner) => {
        this.#banner = banner;
      },
    });
    if ('outcome' in result) return this.#signedOut(result.outcome);
    return this.#finish(() =>
      this.#deps.api.exchange({
        code: result.code,
        codeVerifier: result.verifier,
        redirectUri: result.redirectUri,
        device: this.#deps.device(),
      }),
    );
  }

  // Read through methods: these fields change while a sign-in awaits.
  #hasSession(): boolean {
    return this.#vault.current() !== null;
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
    const session = this.#vault.current();
    if (this.#deps.disabled) return this.#state;
    if (session) {
      // The device slot is freed when the API hears it; offline, the tokens still go (FR-AUTH-6).
      await this.#deps.api.logout(session.refreshToken).catch(() => undefined);
    }
    await this.#clear();
    return this.#signedOut(null);
  }

  /**
   * Delete account (D36): the API cancels billing and deletes the account; then this PC forgets
   * the session and shows "Your account was deleted". Errors (BILLING_UNAVAILABLE, a wrong
   * email) leave the launcher signed in.
   */
  async deleteAccount(confirmEmail: string): Promise<AuthState> {
    await this.#withAccess((token) => this.#deps.api.deleteAccount(token, confirmEmail));
    await this.#clear();
    return this.#signedOut('deleted');
  }

  /** A call with a fresh access token; API errors come back as `AppErrorException`s. */
  accessCall<T>(call: (token: string) => Promise<T>): Promise<T> {
    return this.#withAccess(call);
  }

  /** Shows or ends "Waiting for your payment…" on the signed-in state. */
  setWaiting(waiting: boolean): AuthState {
    if (this.#waiting === waiting || this.#state.kind !== 'signedIn') {
      this.#waiting = waiting && this.#state.kind === 'signedIn';
      return this.#state;
    }
    this.#waiting = waiting;
    return this.#set({ ...this.#state, waitingForPayment: waiting });
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
    const session = this.#vault.current();
    if (!session) return this.#state;
    const generation = this.#generation;
    try {
      await this.#tokens.refresh();
      const answer = await this.#deps.api.entitlement(this.#tokens.token());
      if (generation !== this.#generation) return this.#state;
      this.#banner = answer.banner;
      await this.#vault.store({
        ...session,
        refreshToken: this.#vault.current()?.refreshToken ?? session.refreshToken,
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
      const current = this.#vault.current();
      if (current && offlineAllowed(current, this.#deps.clock())) return this.#signedIn(true);
      // The session stays: reconnecting signs back in without the browser (US-A3).
      return this.#signedOut('offlineExpired');
    }
  }

  async #withAccess<T>(call: (token: string) => Promise<T>): Promise<T> {
    if (!this.#hasSession()) throw unreachable();
    try {
      return await this.#tokens.withAccess(call);
    } catch (error) {
      const failure = failureOf(error);
      if (failure?.kind === 'api' && failure.status === 401) {
        await this.#clear();
        await this.#signedOut('revoked');
      }
      if (failure?.kind === 'api') {
        throw new AppErrorException({
          code: failure.code,
          message: ERROR_CODES[failure.code],
          ...(failure.details === undefined ? {} : { details: failure.details }),
        });
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
    this.#waiting = false;
    this.#banner = session.banner;
    this.#tokens.set(session.accessToken);
    await this.#vault.probe();
    await this.#vault.store({
      deviceId: session.deviceId,
      refreshToken: session.refreshToken,
      user: session.user,
      entitlement: session.entitlement,
      localCheckedAt: this.#deps.clock().toISOString(),
    });
    return this.#signedIn(false);
  }

  async #clear(): Promise<void> {
    this.#generation += 1;
    this.#waiting = false;
    this.#tokens.reset();
    await this.#vault.clear();
  }

  #signedIn(offline: boolean): AuthState {
    const session = this.#vault.current();
    if (!session) return this.#state;
    return this.#set({
      kind: 'signedIn',
      user: session.user,
      entitlement: session.entitlement,
      offline,
      banner: this.#banner,
      remembered: this.#vault.remembered(),
      waitingForPayment: this.#waiting,
    });
  }

  async #signedOut(reason: SignedOutReason | null): Promise<AuthState> {
    // A wait for a payment ends with the signed-in state; signing in again starts fresh.
    this.#waiting = false;
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
