import { join } from 'node:path';
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

  it('billing on without the stub needs both Stripe keys (D33)', () => {
    expect(problems({ ...STUB, BILLING_ENABLED: 'true' })).toEqual([
      expect.stringMatching(/^STRIPE_SECRET_KEY/),
      expect.stringMatching(/^STRIPE_WEBHOOK_SECRET/),
    ]);
    const env = loadEnv({
      ...STUB,
      BILLING_ENABLED: 'true',
      STRIPE_SECRET_KEY: 'sk_test_abc',
      STRIPE_WEBHOOK_SECRET: 'whsec_abc',
    });
    expect(env.billing).toEqual({
      enabled: true,
      mode: 'stripe',
      secretKey: 'sk_test_abc',
      webhookSecret: 'whsec_abc',
    });
  });

  it('Stripe keys must look like Stripe keys', () => {
    expect(
      problems({ ...STUB, STRIPE_SECRET_KEY: 'pk_test_abc', STRIPE_WEBHOOK_SECRET: 'abc' }),
    ).toEqual([
      expect.stringMatching(/^STRIPE_SECRET_KEY/),
      expect.stringMatching(/^STRIPE_WEBHOOK_SECRET/),
    ]);
  });

  it('the billing stub needs no keys and is refused in production (D32)', () => {
    const env = loadEnv({ ...STUB, BILLING_ENABLED: 'true', BILLING_STUB: '1' });
    expect(env.billing).toMatchObject({ enabled: true, mode: 'stub', secretKey: null });
    expect(env.billing.webhookSecret).toMatch(/^whsec_/);
    expect(
      problems({
        ...STUB,
        ...GOOGLE,
        AUTH_STUB: undefined,
        NODE_ENV: 'production',
        BILLING_STUB: '1',
      }),
    ).toEqual([expect.stringMatching(/^BILLING_STUB.*production/)]);
  });

  it('billing off without keys has no provider', () => {
    expect(loadEnv(STUB).billing).toEqual({
      enabled: false,
      mode: 'none',
      secretKey: null,
      webhookSecret: null,
    });
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

  it('files live next to the database unless FILES_DIR says otherwise (D40)', () => {
    expect(loadEnv(STUB).filesDir).toBe(join('./data', 'files'));
    expect(loadEnv({ ...STUB, FILES_DIR: 'D:/nextlevel-files' }).filesDir).toBe(
      'D:/nextlevel-files',
    );
  });

  it('D57: FILE_STORE defaults to the local disk; s3 needs its endpoint, bucket and keys', () => {
    expect(loadEnv(STUB).fileStore).toEqual({ kind: 'local' });
    expect(problems({ ...STUB, FILE_STORE: 's3' })).toEqual([
      'S3_ENDPOINT: is required with FILE_STORE=s3',
      'S3_BUCKET: is required with FILE_STORE=s3',
      'S3_ACCESS_KEY_ID: is required with FILE_STORE=s3',
      'S3_SECRET_ACCESS_KEY: is required with FILE_STORE=s3',
    ]);
    const env = loadEnv({
      ...STUB,
      FILE_STORE: 's3',
      S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
      S3_BUCKET: 'nextlevel-catalog',
      S3_ACCESS_KEY_ID: 'key-id',
      S3_SECRET_ACCESS_KEY: 'key-secret',
    });
    expect(env.fileStore).toEqual({
      kind: 's3',
      endpoint: 'https://acct.r2.cloudflarestorage.com',
      bucket: 'nextlevel-catalog',
      accessKeyId: 'key-id',
      secretAccessKey: 'key-secret',
      region: 'auto',
    });
    expect(problems({ ...STUB, FILE_STORE: 'gdrive' })[0]).toMatch(/^FILE_STORE:/);
  });

  it('D56: HOST defaults to 127.0.0.1; the container listens on 0.0.0.0', () => {
    expect(loadEnv(STUB).host).toBe('127.0.0.1');
    expect(loadEnv({ ...STUB, HOST: '0.0.0.0' }).host).toBe('0.0.0.0');
  });

  it('D56: TRUST_PROXY true or a list; backups can go to their own bucket (BACKUP_S3_*)', () => {
    expect(loadEnv(STUB).trustProxy).toBe(false);
    expect(loadEnv({ ...STUB, TRUST_PROXY: 'true' }).trustProxy).toBe(true);
    expect(loadEnv({ ...STUB, TRUST_PROXY: '172.16.0.0/12, 10.0.0.1' }).trustProxy).toEqual([
      '172.16.0.0/12',
      '10.0.0.1',
    ]);
    expect(loadEnv(STUB).backupStore).toBeNull();
    expect(problems({ ...STUB, BACKUP_S3_BUCKET: 'nextlevel-backups' })).toEqual([
      'BACKUP_S3_ENDPOINT: is required with BACKUP_S3_BUCKET',
      'BACKUP_S3_ACCESS_KEY_ID: is required with BACKUP_S3_BUCKET',
      'BACKUP_S3_SECRET_ACCESS_KEY: is required with BACKUP_S3_BUCKET',
    ]);
    expect(
      loadEnv({
        ...STUB,
        BACKUP_S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
        BACKUP_S3_BUCKET: 'nextlevel-backups',
        BACKUP_S3_ACCESS_KEY_ID: 'backup-id',
        BACKUP_S3_SECRET_ACCESS_KEY: 'backup-secret',
      }).backupStore,
    ).toEqual({
      endpoint: 'https://acct.r2.cloudflarestorage.com',
      bucket: 'nextlevel-backups',
      accessKeyId: 'backup-id',
      secretAccessKey: 'backup-secret',
      region: 'auto',
    });
  });
});
