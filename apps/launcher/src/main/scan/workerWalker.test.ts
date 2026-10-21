import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { walkSystem } from './walk.ts';
import { ScanCancelled } from './walker.ts';
import { createWorkerWalker } from './workerWalker.ts';

const WORKER = new URL('./scanWorker.ts', import.meta.url);
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

describe('createWorkerWalker', () => {
  it('FR-LIB-3: the worker walker returns the same files as walkSystem and stops on terminate', async () => {
    const temp = await tempDir('nextlevel-worker-');
    cleanups.push(temp.cleanup);
    await mkdir(join(temp.dir, 'Sub'));
    await writeFile(join(temp.dir, 'Demo (Disc 1).chd'), 'a');
    await writeFile(join(temp.dir, 'Demo (Disc 2).chd'), 'b');
    await writeFile(join(temp.dir, 'Sub', 'Other.chd'), 'c');
    const job = {
      systemId: 'test',
      dirs: [{ locationId: 'a', dir: temp.dir }],
      extensions: ['chd'],
    };

    const walker = createWorkerWalker(WORKER);
    expect(await walker.walk(job)).toEqual(await walkSystem(job));

    const pending = walker.walk(job);
    walker.stop();
    await expect(pending).rejects.toBeInstanceOf(ScanCancelled);
  });
});
