import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { join } from 'node:path';
import type { AppSettings } from '@nextlevel/shared';
import { buildApp } from '../../api/src/app.ts';
import { openDb } from '../../api/src/db/open.ts';
import { loadEnv } from '../../api/src/env.ts';
import { saveAppSettings } from '../../api/src/settings/AppSettingsRepository.ts';
import { catalogWorld } from '../../api/test/catalogPlayer.ts';
import { signIn } from '../../api/test/launcherSignIn.ts';

/** A 1×1 transparent PNG: box art for the fixture item. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        resolve(typeof address === 'object' && address ? address.port : 0);
      });
    });
  });
}

/**
 * The real NextLevel API for launcher e2e: in-process, on a temp database, with the sign-in stub
 * (`AUTH_STUB=1`) and a random port. Nothing leaves the machine.
 */
export async function startTestApi(
  opts: { settings?: Partial<AppSettings>; billing?: boolean } = {},
) {
  const dir = await mkdtemp(join(tmpdir(), 'nextlevel-e2e-api-'));
  const db = openDb(join(dir, 'api.db'));
  if (opts.settings) saveAppSettings(db, opts.settings);
  if (opts.billing) {
    // A plan on sale through the billing stub (D32): R$ 19,90 a month.
    db.$client
      .prepare(
        `insert into plans (id, slug, name, device_limit, scope_ids, stripe_price_monthly,
           price_monthly_amount, currency, created_at)
         values ('plan-basic', 'basic', 'Basic', 2, '[]', 'price_stub_month_1990_brl', 1990, 'brl', ?)`,
      )
      .run(new Date().toISOString());
  }
  const env = loadEnv({
    NODE_ENV: 'test',
    PUBLIC_URL: 'http://127.0.0.1',
    DATABASE_URL: 'file:unused.db',
    JWT_SECRET: Buffer.alloc(32, 3).toString('base64'),
    ADMIN_EMAILS: 'admin@nextlevel.test',
    BILLING_ENABLED: opts.billing ? 'true' : 'false',
    ...(opts.billing ? { BILLING_STUB: '1' } : {}),
    AUTH_STUB: '1',
    FILES_DIR: join(dir, 'files'),
  });
  // The stub's authorize URL names the API's own address, so the port is chosen first.
  const port = await freePort();
  const url = `http://127.0.0.1:${String(port)}`;
  const app = await buildApp({ env: { ...env, publicUrl: url }, db, clock: () => new Date() });
  await app.listen({ port, host: '127.0.0.1' });
  let open = true;
  let world: Awaited<ReturnType<typeof catalogWorld>> | null = null;
  return {
    url,
    /**
     * Publishes a made-up homebrew item (dummy ROM bytes, a tiny PNG as box art) in the
     * homebrew-8bit scope, which the Default plan then includes. Answers its id.
     */
    async publishItem(slug: string, opts: { onLapse?: 'keep' | 'remove' } = {}) {
      world ??= await catalogWorld(app);
      const id = await world.publish(slug, {
        filename: `${slug}.nes`,
        patch: { onLapse: opts.onLapse ?? 'keep', description: 'A made-up homebrew test game.' },
      });
      await world.admin.raw(`${world.admin.base(id)}/media/box-front`, TINY_PNG, 'image/png');
      await world.planScopes(['homebrew-8bit']);
      return id;
    },
    async unpublish(id: string) {
      world ??= await catalogWorld(app);
      await world.admin.send('POST', `${world.admin.base(id)}/unpublish`);
    },
    /** Signs a stub persona in from "another PC" `count` times (devices for US-A4). */
    async addDevices(persona: 'subscriber', count: number) {
      for (let i = 0; i < count; i += 1) await signIn(app, persona, `Other PC ${String(i + 1)}`);
    },
    async close() {
      if (!open) return;
      open = false;
      await app.close();
      db.$client.close();
      await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(
        () => undefined,
      );
    },
  };
}
