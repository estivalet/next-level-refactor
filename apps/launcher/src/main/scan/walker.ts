import type { WalkJob, WalkResult } from './types.ts';
import { walkSystem } from './walk.ts';

/** Thrown by a pending walk when the scan is cancelled. */
export class ScanCancelled extends Error {
  constructor() {
    super('scan cancelled');
    this.name = 'ScanCancelled';
  }
}

/** Walks one system at a time; `stop` ends the walker and rejects a pending walk. */
export interface Walker {
  walk(job: WalkJob): Promise<WalkResult>;
  stop(): void;
}

/** Walks on the calling thread; for tests. Production uses the worker walker. */
export function inProcessWalker(): Walker {
  let cancel: (() => void) | null = null;
  return {
    walk: (job) =>
      Promise.race([
        walkSystem(job),
        new Promise<never>((_resolve, reject) => {
          cancel = () => {
            reject(new ScanCancelled());
          };
        }),
      ]),
    stop: () => {
      cancel?.();
    },
  };
}
