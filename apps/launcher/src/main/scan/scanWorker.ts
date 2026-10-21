// Worker thread entry: walks folders off the main thread. Imports only node: built-ins and walk
// modules, so it runs both bundled (electron-vite ?modulePath) and as TypeScript in tests.
import { parentPort } from 'node:worker_threads';
import type { WalkJob } from './types.ts';
import { walkSystem } from './walk.ts';

parentPort?.on('message', (job: WalkJob) => {
  walkSystem(job).then(
    (result) => parentPort?.postMessage({ ok: true, result }),
    (error: unknown) => parentPort?.postMessage({ ok: false, message: String(error) }),
  );
});
