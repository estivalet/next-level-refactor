import type { PathLike } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { moveOldData } from './moveOldData.ts';

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function oldTree() {
  const base = await mkdtemp(join(tmpdir(), 'nextlevel-move-'));
  dirs.push(base);
  const from = join(base, 'AppData', 'NextLevel');
  await mkdir(join(from, 'backups'), { recursive: true });
  await writeFile(join(from, 'settings.json'), '{"schemaVersion":1}');
  await writeFile(join(from, 'library.db'), Buffer.alloc(4096, 7));
  await writeFile(join(from, 'backups', 'settings-1.json'), 'old');
  return { base, from, to: join(base, 'NextLevel', 'data') };
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

describe('moving old data into the portable folder (D50)', () => {
  it('moves the whole tree, sizes equal, and removes the old folder', async () => {
    const { from, to } = await oldTree();
    expect(await moveOldData({ from, to })).toBe('moved');
    expect(await readFile(join(to, 'settings.json'), 'utf8')).toBe('{"schemaVersion":1}');
    expect((await stat(join(to, 'library.db'))).size).toBe(4096);
    expect(await readFile(join(to, 'backups', 'settings-1.json'), 'utf8')).toBe('old');
    expect(await exists(from)).toBe(false);
  });

  it('a copy failure mid-way removes the partial copy and keeps the old folder', async () => {
    const { from, to } = await oldTree();
    let copies = 0;
    const result = await moveOldData({
      from,
      to,
      fs: {
        ...fs,
        copyFile: async (source: PathLike, target: PathLike) => {
          copies += 1;
          if (copies === 2) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
          await fs.copyFile(source, target);
        },
      },
    });
    expect(result).toEqual({ failed: expect.stringContaining('ENOSPC') as unknown });
    expect(await exists(to)).toBe(false);
    expect(await readFile(join(from, 'settings.json'), 'utf8')).toBe('{"schemaVersion":1}');
    expect((await stat(join(from, 'library.db'))).size).toBe(4096);
  });

  it('a copied file with the wrong size fails the move', async () => {
    const { from, to } = await oldTree();
    const result = await moveOldData({
      from,
      to,
      fs: {
        ...fs,
        copyFile: async (_source: PathLike, target: PathLike) => {
          await fs.writeFile(target, 'short');
        },
      },
    });
    expect(result).toHaveProperty('failed');
    expect(await exists(to)).toBe(false);
    expect(await exists(join(from, 'library.db'))).toBe(true);
  });

  it('none when the new settings.json exists or there is no old folder', async () => {
    const { from, to } = await oldTree();
    await mkdir(to, { recursive: true });
    await writeFile(join(to, 'settings.json'), '{}');
    expect(await moveOldData({ from, to })).toBe('none');
    expect(await exists(from)).toBe(true);
    expect(await moveOldData({ from: join(from, 'nothing'), to: join(to, 'other') })).toBe('none');
  });
  it('an old folder that cannot be deleted after a good copy is still moved', async () => {
    const { from, to } = await oldTree();
    const result = await moveOldData({
      from,
      to,
      fs: {
        ...fs,
        rm: async (path, options) => {
          if (String(path) === from) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
          await fs.rm(path, options);
        },
      },
    });
    expect(result).toBe('moved');
    expect(await readFile(join(to, 'settings.json'), 'utf8')).toBe('{"schemaVersion":1}');
  });

  it('cleanup never removes a folder holding files it did not copy (a second instance)', async () => {
    const { from, to } = await oldTree();
    let copies = 0;
    const result = await moveOldData({
      from,
      to,
      fs: {
        ...fs,
        copyFile: async (source: PathLike, target: PathLike) => {
          copies += 1;
          if (copies === 1) {
            // Another launcher copied into the same new folder meanwhile.
            await fs.writeFile(join(to, 'backups', 'theirs.json'), 'theirs');
          }
          if (copies === 3) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
          await fs.copyFile(source, target);
        },
      },
    });
    expect(result).toHaveProperty('failed');
    expect(await readFile(join(to, 'backups', 'theirs.json'), 'utf8')).toBe('theirs');
  });
});
