import * as nodeFs from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

export type FsLike = Pick<
  typeof nodeFs,
  'readdir' | 'stat' | 'mkdir' | 'copyFile' | 'rm' | 'rmdir'
>;

const exists = (fs: FsLike, path: string) =>
  fs.stat(path).then(
    () => true,
    () => false,
  );

/**
 * The first portable boot (D50) brings the old `%APPDATA%\NextLevel` (or `NextLevel-dev`) folder
 * into the data folder: every file is copied and its size checked, then the old folder is
 * deleted. Any failure removes what was copied, keeps the old folder untouched and answers
 * `{ failed }`. `none`: nothing to move (no old folder, or the data folder already has
 * settings). Files already in the data folder (e.g. this boot's log) are kept.
 */
export async function moveOldData(o: {
  from: string;
  to: string;
  fs?: FsLike;
}): Promise<'moved' | 'none' | { failed: string }> {
  const fs = o.fs ?? nodeFs;
  if (!(await exists(fs, o.from))) return 'none';
  if (await exists(fs, join(o.to, 'settings.json'))) return 'none';
  const created: Array<{ path: string; dir: boolean }> = [];
  const makeDir = async (dir: string) => {
    if (await exists(fs, dir)) return;
    await makeDir(dirname(dir));
    await fs.mkdir(dir);
    created.push({ path: dir, dir: true });
  };
  const copyTree = async (source: string, target: string): Promise<void> => {
    await makeDir(target);
    for (const entry of await fs.readdir(source, { withFileTypes: true })) {
      const from = join(source, entry.name);
      const to = join(target, entry.name);
      if (entry.isDirectory()) {
        await copyTree(from, to);
        continue;
      }
      if (await exists(fs, to)) continue;
      await fs.copyFile(from, to);
      created.push({ path: to, dir: false });
      const [a, b] = await Promise.all([fs.stat(from), fs.stat(to)]);
      if (a.size !== b.size) throw new Error(`size differs: ${relative(o.from, from)}`);
    }
  };
  try {
    await copyTree(o.from, o.to);
  } catch (error) {
    // Only what this move made: a folder is removed only once empty, so files someone else put
    // there meanwhile (a second launcher) stay.
    for (const item of created.reverse()) {
      const remove = item.dir ? fs.rmdir(item.path) : fs.rm(item.path, { force: true });
      await remove.catch(() => undefined);
    }
    const code = (error as NodeJS.ErrnoException).code;
    return { failed: code ? `${code}: ${String(error)}` : String(error) };
  }
  // Everything is safe in the new folder; an old folder that can't go (a file held open) stays,
  // and the next boot sees settings.json here and leaves it alone.
  await fs.rm(o.from, { recursive: true, force: true }).catch(() => undefined);
  return 'moved';
}
