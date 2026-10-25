import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildApp } from './app.ts';
import { openDb } from './db/open.ts';
import { EnvError, loadEnv } from './env.ts';
import { logOptions } from './log.ts';

// `npm run dev -w apps/api`: env from apps/api/.env, then the API on 127.0.0.1:<PORT>.

async function main(): Promise<void> {
  const env = loadEnv(process.env);
  mkdirSync(dirname(env.databaseFile), { recursive: true });
  const db = openDb(env.databaseFile);
  const app = await buildApp({
    env,
    db,
    clock: () => new Date(),
    log: logOptions(env.nodeEnv),
  });
  const close = () => {
    void app.close().finally(() => {
      db.$client.close();
      process.exit(0);
    });
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  await app.listen({ port: env.port, host: '127.0.0.1' });
}

main().catch((error: unknown) => {
  // An invalid environment names every bad variable; nothing secret is in the message.
  console.error(error instanceof EnvError ? error.message : error);
  process.exit(1);
});
