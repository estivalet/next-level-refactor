import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { apiError } from '../errors.ts';
import type { GoogleIdentity, IdentityProvider } from './identity.ts';

export const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * A Google OAuth client (security §2): exchanges the code (with the PKCE verifier) server-side
 * and verifies the ID token's signature, issuer, audience, expiry and `email_verified`. Google's
 * tokens never leave the API, and its error bodies never reach a response.
 */
export function googleProvider(opts: {
  clientId: string;
  clientSecret: string;
  fetch: typeof fetch;
  jwks: JWTVerifyGetKey;
  clock: () => Date;
}): IdentityProvider {
  const refused = () => apiError('UNAUTHENTICATED', 'Google sign-in failed.');
  return {
    authorizeUrl: GOOGLE_AUTHORIZE_URL,
    clientId: opts.clientId,
    async exchange({ code, codeVerifier, redirectUri }): Promise<GoogleIdentity> {
      let idToken: unknown;
      try {
        const response = await opts.fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: opts.clientId,
            client_secret: opts.clientSecret,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }).toString(),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw refused();
        idToken = ((await response.json()) as { id_token?: unknown }).id_token;
      } catch {
        throw refused();
      }
      if (typeof idToken !== 'string') throw refused();
      try {
        const { payload } = await jwtVerify(idToken, opts.jwks, {
          issuer: ISSUERS,
          audience: opts.clientId,
          currentDate: opts.clock(),
        });
        const {
          sub,
          email,
          email_verified: verified,
          name,
          picture,
        } = payload as Record<string, unknown>;
        if (typeof sub !== 'string' || typeof email !== 'string' || verified !== true) {
          throw refused();
        }
        const lower = email.trim().toLowerCase();
        return {
          sub,
          email: lower,
          name: typeof name === 'string' && name.trim() !== '' ? name : lower,
          avatarUrl: typeof picture === 'string' ? picture : null,
        };
      } catch {
        throw refused();
      }
    },
  };
}
