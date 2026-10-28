import { describe, expect, it } from 'vitest';
import { FakeClock, testEnv } from '../../test/testApp.ts';
import { createContext } from '../context.ts';
import { openDb } from '../db/open.ts';
import { signFileToken, verifyFileToken } from './tokens.ts';

function setup(secret?: string) {
  const clock = new FakeClock();
  const ctx = createContext({
    env: testEnv(secret ? { JWT_SECRET: secret } : {}),
    db: openDb(':memory:'),
    clock: clock.read,
    billing: null,
  });
  return { ctx, clock };
}

const FILE = { kind: 'file' as const, id: 'f1', userId: 'u1', deviceId: 'd1', ttlMs: 10 * 60_000 };

describe('signed file tokens (FR-CAT-6, security §2)', () => {
  it('round-trips: the payload comes back, with its expiry', () => {
    const { ctx } = setup();
    const { token, expiresAt } = signFileToken(ctx, FILE);
    expect(expiresAt).toBe('2026-10-25T12:10:00.000Z');
    expect(verifyFileToken(ctx, token)).toEqual({
      kind: 'file',
      id: 'f1',
      userId: 'u1',
      deviceId: 'd1',
      expiresAt: Date.parse(expiresAt),
    });
  });

  it('an expired token is null', () => {
    const { ctx, clock } = setup();
    const { token } = signFileToken(ctx, FILE);
    clock.advance(10 * 60_000);
    expect(verifyFileToken(ctx, token)).toBeNull();
  });

  it('a tampered payload or signature is null', () => {
    const { ctx } = setup();
    const { token } = signFileToken(ctx, FILE);
    const [payload, signature] = token.split('.');
    const other = signFileToken(ctx, { ...FILE, id: 'f2' }).token.split('.')[0];
    expect(verifyFileToken(ctx, `${String(other)}.${String(signature)}`)).toBeNull();
    expect(verifyFileToken(ctx, `${String(payload)}.${'A'.repeat(43)}`)).toBeNull();
    expect(verifyFileToken(ctx, String(payload))).toBeNull();
    expect(verifyFileToken(ctx, 'not a token')).toBeNull();
  });

  it('a token signed with another secret is null', () => {
    const { ctx } = setup();
    const other = setup(Buffer.alloc(32, 9).toString('base64')).ctx;
    expect(verifyFileToken(ctx, signFileToken(other, FILE).token)).toBeNull();
  });

  it('the kind is part of what is signed', () => {
    const { ctx } = setup();
    const media = signFileToken(ctx, { ...FILE, kind: 'media', id: 'i1/box-front' });
    expect(verifyFileToken(ctx, media.token)?.kind).toBe('media');
  });
});
