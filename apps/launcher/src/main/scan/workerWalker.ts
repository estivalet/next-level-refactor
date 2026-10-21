import { Worker } from 'node:worker_threads';
import type { WalkJob, WalkResult } from './types.ts';
import { ScanCancelled, type Walker } from './walker.ts';

type Reply = { ok: true; result: WalkResult } | { ok: false; message: string };

interface Pending {
  resolve: (result: WalkResult) => void;
  reject: (error: unknown) => void;
}

/**
 * Walks in a worker thread (coding standards: long work off the main thread). One walk at a time;
 * `stop` terminates the worker at once, so a cancel never waits for a slow drive.
 */
export function createWorkerWalker(workerPath: string | URL): Walker {
  let worker: Worker | null = null;
  let pending: Pending | null = null;

  const settle = (action: (current: Pending) => void) => {
    const current = pending;
    pending = null;
    if (current) action(current);
  };

  const start = (): Worker => {
    const created = new Worker(workerPath);
    created.on('message', (reply: Reply) => {
      settle((current) => {
        if (reply.ok) current.resolve(reply.result);
        else current.reject(new Error(reply.message));
      });
    });
    created.on('error', (error) => {
      settle((current) => {
        current.reject(error);
      });
    });
    created.on('exit', () => {
      // A worker terminated by stop() can exit after a new one started.
      if (worker !== created) return;
      worker = null;
      settle((current) => {
        current.reject(new ScanCancelled());
      });
    });
    return created;
  };

  return {
    walk: (job: WalkJob) =>
      new Promise<WalkResult>((resolve, reject) => {
        if (pending) {
          reject(new Error('a walk is already running'));
          return;
        }
        pending = { resolve, reject };
        worker ??= start();
        worker.postMessage(job);
      }),
    stop: () => {
      settle((current) => {
        current.reject(new ScanCancelled());
      });
      void worker?.terminate();
      worker = null;
    },
  };
}
