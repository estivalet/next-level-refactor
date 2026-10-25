import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { MediaWriter } from './MediaWriter.ts';

// Another write may remove the shared temp folder (it is removed when empty) between this
// write's mkdir and its writeFile; the first writeFile then fails with ENOENT.
const race = vi.hoisted(() => ({ failNext: 0 }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    writeFile: (...args: Parameters<typeof actual.writeFile>) => {
      if (race.failNext > 0) {
        race.failNext -= 1;
        return Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      }
      return actual.writeFile(...args);
    },
  };
});

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  race.failNext = 0;
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

describe('MediaWriter temp folder race (FR-SCR-4)', () => {
  it('a temp folder removed by another write is made again and the write succeeds', async () => {
    const temp = await tempDir('nextlevel-media-race-');
    cleanups.push(temp.cleanup);
    const writer = new MediaWriter({ toPng: (bytes) => bytes });
    race.failNext = 1;
    const result = await writer.write(temp.dir, 'box-front', 'Game', Buffer.from('img'), 'png');
    expect(result.path).toBe(join(temp.dir, 'box-front', 'Game.png'));
    expect(await readdir(temp.dir)).toEqual(['box-front']);
  });

  it('a folder that keeps disappearing still fails after three tries', async () => {
    const temp = await tempDir('nextlevel-media-race-');
    cleanups.push(temp.cleanup);
    const writer = new MediaWriter({ toPng: (bytes) => bytes });
    race.failNext = 3;
    await expect(
      writer.write(temp.dir, 'box-front', 'Game', Buffer.from('img'), 'png'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
