import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AppSettings } from '@nextlevel/shared';
import { buildApp, type AppDeps } from '../src/app.ts';
import { openDb, type ApiDb } from '../src/db/open.ts';
import { loadEnv, type Env } from '../src/env.ts';
import { saveAppSettings } from '../src/settings/AppSettingsRepository.ts';

export const TEST_SECRET = Buffer.alloc(32, 7).toString('base64');

/** A stub development environment; `overrides` are raw variables. */
export function testEnv(overrides: Record<string, string | undefined> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    PUBLIC_URL: 'http://localhost:4000',
    DATABASE_URL: 'file:unused.db',
    JWT_SECRET: TEST_SECRET,
    ADMIN_EMAILS: 'admin@nextlevel.test',
    BILLING_ENABLED: 'false',
    AUTH_STUB: '1',
    ...overrides,
  });
}

/** A clock tests move by hand. */
export class FakeClock {
  now: Date;
  constructor(iso = '2026-10-25T12:00:00.000Z') {
    this.now = new Date(iso);
  }
  read = (): Date => new Date(this.now);
  advance(ms: number): void {
    this.now = new Date(this.now.getTime() + ms);
  }
}

/** An app on a fresh SQLite file in the OS temp folder, with a fake clock and no logging. */
export async function createTestApp(
  overrides: Partial<AppDeps> & {
    rawEnv?: Record<string, string | undefined>;
    settings?: Partial<AppSettings>;
  } = {},
): Promise<{
  app: Awaited<ReturnType<typeof buildApp>>;
  db: ApiDb;
  clock: FakeClock;
  /** The temp `FILES_DIR` of this app. */
  filesDir: string;
  close: () => Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), 'nextlevel-api-'));
  const db = openDb(join(dir, 'api.db'));
  const { rawEnv, settings, ...deps } = overrides;
  if (settings) saveAppSettings(db, settings);
  const clock = new FakeClock();
  const app = await buildApp({
    env: testEnv({ FILES_DIR: join(dir, 'files'), ...rawEnv }),
    db,
    clock: clock.read,
    log: false,
    ...deps,
  });
  const close = async () => {
    await app.close();
    db.$client.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  };
  return { app, db, clock, filesDir: join(dir, 'files'), close };
}
