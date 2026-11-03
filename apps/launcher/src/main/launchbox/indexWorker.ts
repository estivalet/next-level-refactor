// Worker thread entry: builds the LaunchBox index off the main thread (FR-SCR-6). Imports only
// node: built-ins and pure modules, so it runs bundled (electron-vite ?modulePath) and in tests.
import { parentPort, workerData } from 'node:worker_threads';
import { buildIndex } from './buildIndex.ts';

const { zipPath, outPath } = workerData as { zipPath: string; outPath: string };
let last = 0;
buildIndex(zipPath, outPath, (share) => {
  // At most one message per percent.
  if (share === 1 || share - last >= 0.01) {
    last = share;
    parentPort?.postMessage({ progress: share });
  }
}).then(
  ({ games }) => parentPort?.postMessage({ done: true, games }),
  (error: unknown) => parentPort?.postMessage({ error: String(error) }),
);
