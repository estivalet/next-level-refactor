import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { LaunchBoxIndex } from './LaunchBoxIndex.ts';
import { writeFixtureZip } from './testing.ts';
import { buildInWorker } from './workerBuild.ts';

const WORKER = new URL('./indexWorker.ts', import.meta.url);
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function zip() {
  const temp = await tempDir('nextlevel-launchbox-');
  cleanups.push(temp.cleanup);
  const path = join(temp.dir, 'Metadata.zip');
  writeFixtureZip(path);
  return { dir: temp.dir, path };
}

describe('LaunchBox index build in a worker (FR-SCR-6)', () => {
  it('builds the index off the main thread and reports progress', async () => {
    const { dir, path } = await zip();
    const shares: number[] = [];
    const out = join(dir, 'launchbox.db');
    await expect(buildInWorker(WORKER)(path, out, (share) => shares.push(share))).resolves.toEqual({
      games: 3,
    });
    expect(shares.at(-1)).toBe(1);
    const index = LaunchBoxIndex.open(out);
    expect(index?.info().games).toBe(3);
    index?.close();
  });

  it('a broken zip rejects with the worker error', async () => {
    const { dir } = await zip();
    const { writeFileSync } = await import('node:fs');
    const bad = join(dir, 'bad.zip');
    writeFileSync(bad, 'not a zip');
    await expect(buildInWorker(WORKER)(bad, join(dir, 'x.db'))).rejects.toThrow();
  });

  it('abort stops the worker and rejects', async () => {
    const { dir, path } = await zip();
    const controller = new AbortController();
    const running = buildInWorker(WORKER)(path, join(dir, 'y.db'), undefined, controller.signal);
    controller.abort();
    await expect(running).rejects.toThrow(/abort/i);
  });
});
