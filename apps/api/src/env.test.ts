import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv } from './env.ts';

const SECRET = Buffer.alloc(32, 7).toString('base64');
const STUB = {
  NODE_ENV: 'development',
  PUBLIC_URL: 'http://localhost:4000',
  DATABASE_URL: 'file:./data/nextlevel.db',
  JWT_SECRET: SECRET,
  ADMIN_EMAILS: 'Owner@Example.test, second@example.test',
  BILLING_ENABLED: 'false',
  AUTH_STUB: '1',
};
const GOOGLE = {
  GOOGLE_CLIENT_ID_DESKTOP: 'desktop-id',
  GOOGLE_CLIENT_SECRET_DESKTOP: 'desktop-secret',
  GOOGLE_CLIENT_ID_WEB: 'web-id',
  GOOGLE_CLIENT_SECRET_WEB: 'web-secret',
};

function problems(source: Record<string, string | undefined>): string[] {
  try {
    loadEnv(source);
  } catch (error) {
    if (error instanceof EnvError) return error.problems;
    throw error;
  }
  return [];
}

describe('API environment (environment-setup, ADR-007)', () => {
  it('a stub development setup loads with defaults', () => {
    const env = loadEnv(STUB);
    expect(env).toMatchObject({
      nodeEnv: 'development',
      port: 4000,
      publicUrl: 'http://localhost:4000',
      databaseFile: './data/nextlevel.db',
      adminEmails: ['owner@example.test', 'second@example.test'],
      authStub: true,
      google: null,
      adminDist: null,
      adminOrigin: null,
      jwtSecretPrevious: null,
    });
    expect(env.jwtSecret.length).toBe(32);
  });

  it('every bad variable is named in one error', () => {
    const found = problems({ ...STUB, JWT_SECRET: undefined, PUBLIC_URL: 'not a url' });
    expect(found.some((p) => p.startsWith('JWT_SECRET'))).toBe(true);
    expect(found.some((p) => p.startsWith('PUBLIC_URL'))).toBe(true);
  });

  it('a JWT secret under 32 bytes is refused', () => {
    expect(problems({ ...STUB, JWT_SECRET: Buffer.alloc(16).toString('base64') })).toEqual([
      expect.stringMatching(/^JWT_SECRET/),
    ]);
  });

  it('the stub is refused in production', () => {
    expect(problems({ ...STUB, ...GOOGLE, NODE_ENV: 'production' })).toEqual([
      expect.stringMatching(/^AUTH_STUB/),
    ]);
  });

  it('Google clients are required without the stub, optional with it', () => {
    const missing = problems({ ...STUB, AUTH_STUB: undefined });
    expect(missing.some((p) => p.startsWith('GOOGLE_CLIENT_ID_DESKTOP'))).toBe(true);
    expect(missing.some((p) => p.startsWith('GOOGLE_CLIENT_SECRET_WEB'))).toBe(true);
    const env = loadEnv({ ...STUB, ...GOOGLE, AUTH_STUB: undefined });
    expect(env.google).toEqual({
      desktop: { clientId: 'desktop-id', clientSecret: 'desktop-secret' },
      web: { clientId: 'web-id', clientSecret: 'web-secret' },
    });
    expect(env.authStub).toBe(false);
  });

  it('billing arrives in M8: BILLING_ENABLED=true is refused (D21)', () => {
    expect(problems({ ...STUB, BILLING_ENABLED: 'true' })).toEqual([
      expect.stringMatching(/^BILLING_ENABLED.*M8/),
    ]);
  });

  it('at least one bootstrap admin email is required (FR-AUTH-4)', () => {
    expect(problems({ ...STUB, ADMIN_EMAILS: ' , ' })).toEqual([
      expect.stringMatching(/^ADMIN_EMAILS/),
    ]);
    expect(problems({ ...STUB, ADMIN_EMAILS: 'nope' })).toEqual([
      expect.stringMatching(/^ADMIN_EMAILS/),
    ]);
  });

  it('the database must be a file: URL', () => {
    expect(problems({ ...STUB, DATABASE_URL: 'postgres://x' })).toEqual([
      expect.stringMatching(/^DATABASE_URL/),
    ]);
  });
});
