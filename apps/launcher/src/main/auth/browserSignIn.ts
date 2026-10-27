import type { SignedOutReason } from '@nextlevel/shared';
import type { AuthDeps } from './AuthService.ts';
import { createPkce } from './pkce.ts';
import { authorizeUrlAllowed } from './rules.ts';

const BROWSER_WAIT_MS = 5 * 60_000;

export type BrowserSignInResult =
  { code: string; verifier: string; redirectUri: string } | { outcome: SignedOutReason };

export interface BrowserSignInHooks {
  cancelled: () => boolean;
  /** The listener, so Cancel can close it (null once it answered). */
  onLoop: (loop: { close(): void } | null) => void;
  /** The maintenance banner from the launcher config, as soon as it arrives (D28). */
  onBanner: (banner: string | null) => void;
}

/**
 * The browser half of a sign-in (ADR-006, IA F1): launcher config → PKCE → loopback → system
 * browser → the code.
 */
export async function browserSignIn(
  deps: Pick<AuthDeps, 'api' | 'loopback' | 'pkce' | 'page' | 'openBrowser' | 'apiOrigin' | 'log'>,
  hooks: BrowserSignInHooks,
): Promise<BrowserSignInResult> {
  const { cancelled, onLoop } = hooks;
  let config;
  try {
    config = await deps.api.launcherConfig();
  } catch {
    return { outcome: 'unreachable' };
  }
  hooks.onBanner(config.banner);
  if (cancelled()) return { outcome: 'cancelled' };
  if (!authorizeUrlAllowed(config.authorizeUrl, deps.apiOrigin)) {
    deps.log.warn({}, 'sign-in refused: unexpected authorize URL');
    return { outcome: 'error' };
  }
  const pkce = (deps.pkce ?? createPkce)();
  const loop = await deps.loopback({
    state: pkce.state,
    timeoutMs: BROWSER_WAIT_MS,
    page: deps.page,
  });
  onLoop(loop);
  if (cancelled()) loop.close();
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
  if (!cancelled()) await deps.openBrowser(url.toString());
  const result = await loop.result;
  onLoop(null);
  if ('cancelled' in result) return { outcome: 'cancelled' };
  if ('timeout' in result) return { outcome: 'timeout' };
  return { code: result.code, verifier: pkce.verifier, redirectUri: loop.redirectUri };
}
