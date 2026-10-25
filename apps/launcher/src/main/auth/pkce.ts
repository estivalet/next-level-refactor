import { createHash, randomBytes } from 'node:crypto';

/** One sign-in's PKCE pair (RFC 7636, S256) and OAuth state. */
export function createPkce(random: (size: number) => Buffer = randomBytes): {
  verifier: string;
  challenge: string;
  state: string;
} {
  const verifier = random(48).toString('base64url');
  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
    state: random(24).toString('base64url'),
  };
}
