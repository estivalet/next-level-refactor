import {
  AppErrorException,
  ERROR_CODES,
  type AuthState,
  type BillingInterval,
  type PlansResponse,
} from '@nextlevel/shared';
import { ApiFailure, type ApiClient } from './ApiClient.ts';
import type { AuthService } from './AuthService.ts';
import { billingUrlAllowed } from './billingUrls.ts';

export const POLL_EVERY_MS = 3000;
export const WAIT_FOR_PAYMENT_MS = 2 * 60_000;

export interface BillingDeps {
  auth: Pick<AuthService, 'accessCall' | 'refreshEntitlement' | 'setWaiting' | 'state'>;
  api: Pick<ApiClient, 'plans' | 'checkout' | 'portal'>;
  openBrowser: (url: string) => Promise<void>;
  apiOrigin: string;
  /** Runs `run` every `ms`; returns a stop function. */
  every: (ms: number, run: () => void) => () => void;
  clock: () => Date;
  log: { warn(context: object, msg: string): void };
}

const appError = (code: 'VALIDATION_FAILED' | 'API_UNREACHABLE') =>
  new AppErrorException({ code, message: ERROR_CODES[code] });

const hasAccess = (state: AuthState) =>
  state.kind === 'signedIn' &&
  (state.entitlement.status === 'active' || state.entitlement.status === 'grace');

/**
 * Subscribe and Manage billing from the launcher (FR-SUB-2, IA F7). Checkout and the Portal open
 * in the system browser; while Checkout is open, the entitlement is polled every 3 s for up to
 * 2 minutes so the launcher unlocks without a restart (US-A2).
 */
export class BillingService {
  readonly #deps: BillingDeps;
  #opening: Promise<AuthState> | null = null;
  #stopPolling: (() => void) | null = null;

  constructor(deps: BillingDeps) {
    this.#deps = deps;
  }

  async plans(): Promise<PlansResponse> {
    try {
      return await this.#deps.api.plans();
    } catch (error) {
      if (error instanceof ApiFailure && error.failure.kind === 'api') {
        const { code } = error.failure;
        throw new AppErrorException({ code, message: ERROR_CODES[code] });
      }
      throw appError('API_UNREACHABLE');
    }
  }

  /** Single-flight (Review Focus 3): a double click opens one Checkout. */
  openCheckout(planSlug: string, interval: BillingInterval): Promise<AuthState> {
    this.#opening ??= this.#openCheckout(planSlug, interval).finally(() => {
      this.#opening = null;
    });
    return this.#opening;
  }

  async #openCheckout(planSlug: string, interval: BillingInterval): Promise<AuthState> {
    let url: string;
    try {
      url = (
        await this.#deps.auth.accessCall((token) =>
          this.#deps.api.checkout(token, { planSlug, interval }),
        )
      ).url;
    } catch (error) {
      // Already paying (or granted) — the entitlement just hasn't caught up yet.
      if (isSubscribed(error)) return this.#deps.auth.refreshEntitlement();
      throw error;
    }
    await this.#open(url, 'checkout');
    this.#stop();
    const deadline = this.#deps.clock().getTime() + WAIT_FOR_PAYMENT_MS;
    this.#stopPolling = this.#deps.every(POLL_EVERY_MS, () => {
      void this.#poll(deadline);
    });
    return this.#deps.auth.setWaiting(true);
  }

  async #poll(deadline: number): Promise<void> {
    if (this.#deps.auth.state().kind !== 'signedIn') {
      this.stopWaiting();
      return;
    }
    if (this.#deps.clock().getTime() >= deadline) {
      this.stopWaiting();
      return;
    }
    const state = await this.#deps.auth.refreshEntitlement();
    if (hasAccess(state) || state.kind !== 'signedIn') this.stopWaiting();
  }

  async openPortal(): Promise<void> {
    const { url } = await this.#deps.auth.accessCall((token) => this.#deps.api.portal(token));
    await this.#open(url, 'portal');
  }

  /** "Choose another plan", a timeout, or access: the wait ends. */
  stopWaiting(): AuthState {
    this.#stop();
    return this.#deps.auth.setWaiting(false);
  }

  dispose(): void {
    this.#stop();
  }

  async #open(url: string, kind: 'checkout' | 'portal'): Promise<void> {
    if (!billingUrlAllowed(url, kind, this.#deps.apiOrigin)) {
      // The URL itself is not logged: it may carry a session id.
      this.#deps.log.warn({ code: 'VALIDATION_FAILED', kind }, 'billing URL refused');
      throw appError('VALIDATION_FAILED');
    }
    await this.#deps.openBrowser(url);
  }

  #stop(): void {
    this.#stopPolling?.();
    this.#stopPolling = null;
  }
}

function isSubscribed(error: unknown): boolean {
  if (!(error instanceof AppErrorException) || error.error.code !== 'CONFLICT') return false;
  const details = error.error.details as { reason?: unknown } | undefined;
  return details?.reason === 'subscribed';
}
