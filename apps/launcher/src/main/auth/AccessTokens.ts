import type { ApiClient } from './ApiClient.ts';
import type { SessionVault } from './SessionVault.ts';

/** Access tokens live 15 minutes; renew a little before. */
const ACCESS_FRESH_MS = 13 * 60_000;

export interface AccessTokensDeps {
  api: Pick<ApiClient, 'refresh'>;
  vault: SessionVault;
  clock: () => Date;
  /** The session generation (bumped on sign-in, sign-out, revoke). */
  generation: () => number;
}

/**
 * The in-memory access token and its renewal. Refreshes are single-flight: presenting a rotated
 * refresh token twice would revoke this PC (C7). The rotated token is stored before anything
 * else uses it, and a refresh that outlives its session (sign-out, new sign-in) stores nothing.
 */
export class AccessTokens {
  readonly #deps: AccessTokensDeps;
  #access: { token: string; at: number } | null = null;
  #refreshing: Promise<void> | null = null;

  constructor(deps: AccessTokensDeps) {
    this.#deps = deps;
  }

  set(token: string): void {
    this.#access = { token, at: this.#deps.clock().getTime() };
  }

  reset(): void {
    this.#access = null;
  }

  token(): string {
    return this.#access?.token ?? '';
  }

  refresh(): Promise<void> {
    this.#refreshing ??= (async () => {
      const session = this.#deps.vault.current();
      if (!session) throw new Error('no session');
      const generation = this.#deps.generation();
      const pair = await this.#deps.api.refresh({
        refreshToken: session.refreshToken,
        deviceId: session.deviceId,
      });
      if (generation !== this.#deps.generation()) throw new Error('signed out meanwhile');
      this.set(pair.accessToken);
      await this.#deps.vault.store({ ...session, refreshToken: pair.refreshToken });
    })().finally(() => {
      this.#refreshing = null;
    });
    return this.#refreshing;
  }

  /** Calls the API with a fresh access token; API failures reach the caller unchanged. */
  async withAccess<T>(call: (token: string) => Promise<T>): Promise<T> {
    const access = this.#access;
    if (!access || this.#deps.clock().getTime() - access.at > ACCESS_FRESH_MS) {
      await this.refresh();
    }
    return call(this.token());
  }
}
