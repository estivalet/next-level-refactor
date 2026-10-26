import { createHash, randomBytes } from 'node:crypto';
import { apiError } from '../errors.ts';
import type {
  ExchangeInput,
  GoogleIdentity,
  IdentityProvider,
  IdentityProviders,
} from './identity.ts';

// `AUTH_STUB=1` (development and tests only, refused in production by env.ts): a local
// stand-in for Google with fixed personas. Codes are single-use, short-lived and PKCE-checked,
// so the launcher's real flow is exercised end to end.

export const STUB_PERSONAS = ['admin', 'subscriber', 'suspended', 'outsider'] as const;
export type StubPersona = (typeof STUB_PERSONAS)[number];

const CODE_LIFETIME_MS = 60_000;

interface PendingCode {
  persona: StubPersona;
  challenge: string;
  redirectUri: string;
  expiresAt: number;
}

export interface StubProviders extends IdentityProviders {
  /** Issues a code for a persona, as the stub's authorize page does. */
  issue(persona: StubPersona, challenge: string, redirectUri: string): string;
}

function identity(persona: StubPersona): GoogleIdentity {
  return {
    sub: `stub-${persona}`,
    email: `${persona}@nextlevel.test`,
    name: persona.charAt(0).toUpperCase() + persona.slice(1),
    avatarUrl: null,
    stub: { allowListed: persona !== 'outsider', suspended: persona === 'suspended' },
  };
}

export function stubProviders(opts: { publicUrl: string; clock: () => Date }): StubProviders {
  const codes = new Map<string, PendingCode>();
  const refused = () => apiError('UNAUTHENTICATED', 'Stub sign-in failed.');
  const provider: IdentityProvider = {
    authorizeUrl: `${opts.publicUrl}/v1/auth/stub/authorize`,
    clientId: 'stub',
    exchange: ({ code, codeVerifier, redirectUri }: ExchangeInput) => {
      const pending = codes.get(code);
      codes.delete(code);
      const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
      if (
        !pending ||
        pending.expiresAt < opts.clock().getTime() ||
        pending.challenge !== challenge ||
        pending.redirectUri !== redirectUri
      ) {
        return Promise.reject(refused());
      }
      return Promise.resolve(identity(pending.persona));
    },
  };
  return {
    desktop: provider,
    web: provider,
    issue(persona, challenge, redirectUri) {
      const code = `stub.${randomBytes(18).toString('base64url')}`;
      codes.set(code, {
        persona,
        challenge,
        redirectUri,
        expiresAt: opts.clock().getTime() + CODE_LIFETIME_MS,
      });
      return code;
    },
  };
}
