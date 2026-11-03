import { Worker } from 'node:worker_threads';

type Reply = { progress: number } | { done: true; games: number } | { error: string };

export type BuildInWorker = (
  zipPath: string,
  outPath: string,
  onProgress?: (share: number) => void,
  signal?: AbortSignal,
) => Promise<{ games: number }>;

/**
 * Runs buildIndex in a worker thread (coding standards: long work off the main thread). An abort
 * terminates the worker at once; the half-written output is the caller's to delete.
 */
export function buildInWorker(workerPath: string | URL): BuildInWorker {
  return (zipPath, outPath, onProgress, signal) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
        return;
      }
      const worker = new Worker(workerPath, { workerData: { zipPath, outPath } });
      let settled = false;
      const settle = (action: () => void) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        action();
        void worker.terminate();
      };
      const onAbort = () => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        // The worker holds the output file open: reject only once it has stopped, so the caller
        // can delete the half-written file (Windows refuses to delete an open file).
        void worker.terminate().finally(() => {
          reject(signal?.reason instanceof Error ? signal.reason : new Error('aborted'));
        });
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      worker.on('message', (reply: Reply) => {
        if (settled) return;
        if ('progress' in reply) onProgress?.(reply.progress);
        else if ('done' in reply)
          settle(() => {
            resolve({ games: reply.games });
          });
        else
          settle(() => {
            reject(new Error(reply.error));
          });
      });
      worker.on('error', (error: unknown) => {
        settle(() => {
          reject(error instanceof Error ? error : new Error(String(error)));
        });
      });
      worker.on('exit', (code) => {
        settle(() => {
          reject(new Error(`LaunchBox index worker exited (${String(code)})`));
        });
      });
    });
}
