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
  adminOrigin: string | null;
}

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
    BILLING_ENABLED: z.enum(['true', 'false']).refine((value) => value === 'false', {
      message: 'must be false: billing arrives in M8',
    }),
    AUTH_STUB: z
      .enum(['0', '1'])
      .optional()
      .transform((value) => value === '1'),
    ADMIN_DIST: optional,
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
  });

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
    adminOrigin: env.ADMIN_ORIGIN ?? null,
  };
}
