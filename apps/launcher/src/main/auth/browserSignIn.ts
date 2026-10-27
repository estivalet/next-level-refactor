import type { SignedOutReason } from '@nextlevel/shared';
import type { AuthDeps } from './AuthService.ts';
import { createPkce } from './pkce.ts';
import { authorizeUrlAllowed } from './rules.ts';

const BROWSER_WAIT_MS = 5 * 60_000;

export type BrowserSignInResult =
  | { code: string; verifier: string; redirectUri: string; banner: string | null }
  | { outcome: SignedOutReason; banner: string | null };

/**
 * The browser half of a sign-in (ADR-006, IA F1): launcher config → PKCE → loopback → system
 * browser → the code. `onLoop` hands the listener to the caller so Cancel can close it.
 */
export async function browserSignIn(
  deps: Pick<AuthDeps, 'api' | 'loopback' | 'pkce' | 'page' | 'openBrowser' | 'apiOrigin' | 'log'>,
  cancelled: () => boolean,
  onLoop: (loop: { close(): void } | null) => void,
): Promise<BrowserSignInResult> {
  let config;
  try {
    config = await deps.api.launcherConfig();
  } catch {
    return { outcome: 'unreachable', banner: null };
  }
  const banner = config.banner;
  if (cancelled()) return { outcome: 'cancelled', banner };
  if (!authorizeUrlAllowed(config.authorizeUrl, deps.apiOrigin)) {
    deps.log.warn({}, 'sign-in refused: unexpected authorize URL');
    return { outcome: 'error', banner };
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
  if ('cancelled' in result) return { outcome: 'cancelled', banner };
  if ('timeout' in result) return { outcome: 'timeout', banner };
  return { code: result.code, verifier: pkce.verifier, redirectUri: loop.redirectUri, banner };
}
