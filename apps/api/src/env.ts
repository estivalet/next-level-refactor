import { dirname, join } from 'node:path';
import { EmailSchema } from '@nextlevel/shared';
import { z } from 'zod';

// The API's environment (environment-setup.md): validated once at start; a bad value stops the
// process with every problem named. Secrets are never logged.

export interface GoogleClient {
  clientId: string;
  clientSecret: string;
}

export interface Env {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  /** The address to listen on: 127.0.0.1, or 0.0.0.0 in the container (Caddy in front). */
  host: string;
  /**
   * Which proxies' `X-Forwarded-For` to believe (Fastify `trustProxy`): false, true (any: only
   * when nothing but the proxy can reach the API, as in deploy/compose.yaml), or addresses/CIDRs.
   */
  trustProxy: boolean | string[];
  publicUrl: string;
  /** The SQLite file from `DATABASE_URL` (`file:<path>`). */
  databaseFile: string;
  jwtSecret: Buffer;
  jwtSecretPrevious: Buffer | null;
  /** Null with `AUTH_STUB=1`. */
  google: { desktop: GoogleClient; web: GoogleClient } | null;
  adminEmails: string[];
  authStub: boolean;
  adminDist: string | null;
  /** Catalog files, art and license evidence (`FILES_DIR`, default `<database folder>/files`). */
  filesDir: string;
  /**
   * Where catalog files live (D40, D57): the local disk (`FILES_DIR`, the API serves them) or an
   * S3-compatible bucket (Cloudflare R2; downloads go straight to it through presigned URLs).
   */
  fileStore:
    | { kind: 'local' }
    | {
        kind: 's3';
        endpoint: string;
        bucket: string;
        accessKeyId: string;
        secretAccessKey: string;
        region: string;
      };
  /**
   * A bucket of its own for the daily backups (BACKUP_S3_*), with its own key, so a key leaked
   * from the API can't delete them; null = the file store above.
   */
  backupStore: {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  } | null;
  adminOrigin: string | null;
  /**
   * `enabled`: access needs a subscription or comp grant (D33). `mode`: which provider serves
   * prices and checkout: `stub` with `BILLING_STUB=1` (D32), `stripe` with keys, else `none`.
   */
  billing: {
    enabled: boolean;
    mode: 'stripe' | 'stub' | 'none';
    secretKey: string | null;
    webhookSecret: string | null;
  };
}

/** The stub signs its own webhooks with this; it is not a secret. */
export const STUB_WEBHOOK_SECRET = 'whsec_nextlevel_stub_development_only';

export class EnvError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Invalid API environment:\n${problems.map((p) => `  ${p}`).join('\n')}`);
    this.name = 'EnvError';
    this.problems = problems;
  }
}

const optional = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? null : value.trim()));

const secret = z.string().refine((value) => Buffer.from(value, 'base64').length >= 32, {
  message: 'must be at least 32 random bytes, base64',
});

const GOOGLE_KEYS = [
  'GOOGLE_CLIENT_ID_DESKTOP',
  'GOOGLE_CLIENT_SECRET_DESKTOP',
  'GOOGLE_CLIENT_ID_WEB',
  'GOOGLE_CLIENT_SECRET_WEB',
] as const;

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().min(0).max(65535).default(4000),
    HOST: z.union([z.ipv4(), z.ipv6()]).default('127.0.0.1'),
    TRUST_PROXY: optional,
    PUBLIC_URL: z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, '')),
    DATABASE_URL: z.string().regex(/^file:.+/, 'must be file:<path>'),
    JWT_SECRET: secret,
    JWT_SECRET_PREVIOUS: secret.optional(),
    GOOGLE_CLIENT_ID_DESKTOP: optional,
    GOOGLE_CLIENT_SECRET_DESKTOP: optional,
    GOOGLE_CLIENT_ID_WEB: optional,
    GOOGLE_CLIENT_SECRET_WEB: optional,
    ADMIN_EMAILS: z.preprocess(
      (list) =>
        typeof list === 'string'
          ? list
              .split(',')
              .map((email) => email.trim())
              .filter(Boolean)
          : list,
      z.array(EmailSchema).min(1, 'needs at least one email'),
    ),
    BILLING_ENABLED: z.enum(['true', 'false']).transform((value) => value === 'true'),
    BILLING_STUB: z
      .enum(['0', '1'])
      .optional()
      .transform((value) => value === '1'),
    STRIPE_SECRET_KEY: optional.refine(
      (value) => value === null || /^sk_(test|live)_/.test(value),
      {
        message: 'must be a Stripe secret key (sk_test_… or sk_live_…)',
      },
    ),
    STRIPE_WEBHOOK_SECRET: optional.refine(
      (value) => value === null || value.startsWith('whsec_'),
      {
        message: 'must be a Stripe webhook signing secret (whsec_…)',
      },
    ),
    AUTH_STUB: z
      .enum(['0', '1'])
      .optional()
      .transform((value) => value === '1'),
    ADMIN_DIST: optional,
    FILES_DIR: optional,
    FILE_STORE: z.enum(['local', 's3']).default('local'),
    S3_ENDPOINT: z.url({ protocol: /^https?$/ }).optional(),
    S3_BUCKET: optional,
    S3_ACCESS_KEY_ID: optional,
    S3_SECRET_ACCESS_KEY: optional,
    S3_REGION: z.string().trim().min(1).default('auto'),
    BACKUP_S3_ENDPOINT: z.url({ protocol: /^https?$/ }).optional(),
    BACKUP_S3_BUCKET: optional,
    BACKUP_S3_ACCESS_KEY_ID: optional,
    BACKUP_S3_SECRET_ACCESS_KEY: optional,
    BACKUP_S3_REGION: z.string().trim().min(1).default('auto'),
    ADMIN_ORIGIN: z.url().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_STUB && env.NODE_ENV === 'production') {
      ctx.addIssue({ code: 'custom', path: ['AUTH_STUB'], message: 'is refused in production' });
    }
    if (!env.AUTH_STUB) {
      for (const key of GOOGLE_KEYS) {
        if (env[key] === null) {
          ctx.addIssue({ code: 'custom', path: [key], message: 'is required without AUTH_STUB=1' });
        }
      }
    }
    if (env.FILE_STORE === 's3') {
      for (const key of [
        'S3_ENDPOINT',
        'S3_BUCKET',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
      ] as const) {
        if (!env[key]) {
          ctx.addIssue({ code: 'custom', path: [key], message: 'is required with FILE_STORE=s3' });
        }
      }
    }
    if (env.BACKUP_S3_BUCKET) {
      for (const key of [
        'BACKUP_S3_ENDPOINT',
        'BACKUP_S3_ACCESS_KEY_ID',
        'BACKUP_S3_SECRET_ACCESS_KEY',
      ] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'is required with BACKUP_S3_BUCKET',
          });
        }
      }
    }
    if (env.BILLING_STUB && env.NODE_ENV === 'production') {
      ctx.addIssue({ code: 'custom', path: ['BILLING_STUB'], message: 'is refused in production' });
    }
    if (env.BILLING_ENABLED && !env.BILLING_STUB) {
      for (const key of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const) {
        if (env[key] === null) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'is required with BILLING_ENABLED=true unless BILLING_STUB=1',
          });
        }
      }
    }
  });

function billingOf(env: z.output<typeof EnvSchema>): Env['billing'] {
  const enabled = env.BILLING_ENABLED;
  if (env.BILLING_STUB) {
    return { enabled, mode: 'stub', secretKey: null, webhookSecret: STUB_WEBHOOK_SECRET };
  }
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    return {
      enabled,
      mode: 'stripe',
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    };
  }
  return { enabled, mode: 'none', secretKey: null, webhookSecret: null };
}

function fileStoreOf(env: z.output<typeof EnvSchema>): Env['fileStore'] {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
  if (
    env.FILE_STORE !== 's3' ||
    !S3_ENDPOINT ||
    !S3_BUCKET ||
    !S3_ACCESS_KEY_ID ||
    !S3_SECRET_ACCESS_KEY
  ) {
    return { kind: 'local' };
  }
  return {
    kind: 's3',
    endpoint: S3_ENDPOINT.replace(/\/+$/, ''),
    bucket: S3_BUCKET,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    region: env.S3_REGION,
  };
}

export function loadEnv(source: Record<string, string | undefined>): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new EnvError(
      parsed.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`),
    );
  }
  const env = parsed.data;
  const desktopId = env.GOOGLE_CLIENT_ID_DESKTOP;
  const desktopSecret = env.GOOGLE_CLIENT_SECRET_DESKTOP;
  const webId = env.GOOGLE_CLIENT_ID_WEB;
  const webSecret = env.GOOGLE_CLIENT_SECRET_WEB;
  const google =
    env.AUTH_STUB || !desktopId || !desktopSecret || !webId || !webSecret
      ? null
      : {
          desktop: { clientId: desktopId, clientSecret: desktopSecret },
          web: { clientId: webId, clientSecret: webSecret },
        };
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    trustProxy:
      env.TRUST_PROXY === null || env.TRUST_PROXY === 'false'
        ? false
        : env.TRUST_PROXY === 'true'
          ? true
          : env.TRUST_PROXY.split(',')
              .map((entry) => entry.trim())
              .filter(Boolean),
    publicUrl: env.PUBLIC_URL,
    databaseFile: env.DATABASE_URL.slice('file:'.length),
    jwtSecret: Buffer.from(env.JWT_SECRET, 'base64'),
    jwtSecretPrevious: env.JWT_SECRET_PREVIOUS
      ? Buffer.from(env.JWT_SECRET_PREVIOUS, 'base64')
      : null,
    google,
    adminEmails: env.ADMIN_EMAILS,
    authStub: env.AUTH_STUB,
    adminDist: env.ADMIN_DIST,
    filesDir: env.FILES_DIR ?? join(dirname(env.DATABASE_URL.slice('file:'.length)), 'files'),
    fileStore: fileStoreOf(env),
    backupStore:
      env.BACKUP_S3_BUCKET &&
      env.BACKUP_S3_ENDPOINT &&
      env.BACKUP_S3_ACCESS_KEY_ID &&
      env.BACKUP_S3_SECRET_ACCESS_KEY
        ? {
            endpoint: env.BACKUP_S3_ENDPOINT.replace(/\/+$/, ''),
            bucket: env.BACKUP_S3_BUCKET,
            accessKeyId: env.BACKUP_S3_ACCESS_KEY_ID,
            secretAccessKey: env.BACKUP_S3_SECRET_ACCESS_KEY,
            region: env.BACKUP_S3_REGION,
          }
        : null,
    adminOrigin: env.ADMIN_ORIGIN ?? null,
    billing: billingOf(env),
  };
}
