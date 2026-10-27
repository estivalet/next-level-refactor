import { describe, expect, it } from 'vitest';
import { memorySecrets } from '../secrets/testing.ts';
import { AccessTokens } from './AccessTokens.ts';
import { SessionVault } from './SessionVault.ts';
import { storedSession, T0 } from './testing.ts';

function setup() {
  let now = T0;
  let generation = 0;
  const refreshes: string[] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const vault = new SessionVault(memorySecrets({ 'auth.session': storedSession(T0) }), {
    warn: () => undefined,
  });
  const tokens = new AccessTokens({
    api: {
      refresh: async (body) => {
        refreshes.push(body.refreshToken);
        await gate;
        return { accessToken: `a${String(refreshes.length)}`, refreshToken: 'r1' };
      },
    },
    vault,
    clock: () => new Date(now),
    generation: () => generation,
  });
  return {
    vault,
    tokens,
    refreshes,
    release: () => {
      release();
    },
    advance: (ms: number) => {
      now += ms;
    },
    bump: () => {
      generation += 1;
    },
  };
}

describe('AccessTokens (C7: a rotated refresh token is never presented twice)', () => {
  it('two calls with a stale token make one refresh and both use the new access token', async () => {
    const { vault, tokens, refreshes, release } = setup();
    await vault.load();
    const seen: string[] = [];
    const one = tokens.withAccess((token) => Promise.resolve(seen.push(token)));
    const two = tokens.withAccess((token) => Promise.resolve(seen.push(token)));
    release();
    await Promise.all([one, two]);
    expect(refreshes).toEqual(['r0']);
    expect(seen).toEqual(['a1', 'a1']);
    expect(vault.current()?.refreshToken).toBe('r1');
  });

  it('a fresh token is used as is; after 13 minutes it is renewed', async () => {
    const { vault, tokens, refreshes, release, advance } = setup();
    await vault.load();
    release();
    tokens.set('a0');
    expect(await tokens.withAccess((token) => Promise.resolve(token))).toBe('a0');
    expect(refreshes).toEqual([]);
    advance(13 * 60_000 + 1);
    expect(await tokens.withAccess((token) => Promise.resolve(token))).toBe('a1');
  });

  it('a refresh whose session changed meanwhile rejects and stores nothing', async () => {
    const { vault, tokens, release, bump } = setup();
    await vault.load();
    const pending = tokens.refresh();
    bump();
    release();
    await expect(pending).rejects.toThrow();
    expect(vault.current()?.refreshToken).toBe('r0');
  });
});
