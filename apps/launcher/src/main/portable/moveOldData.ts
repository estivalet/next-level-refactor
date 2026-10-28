import * as nodeFs from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

export type FsLike = Pick<typeof nodeFs, 'readdir' | 'stat' | 'mkdir' | 'copyFile' | 'rm'>;

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
  const created: string[] = [];
  const makeDir = async (dir: string) => {
    if (await exists(fs, dir)) return;
    await makeDir(dirname(dir));
    await fs.mkdir(dir);
    created.push(dir);
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
      created.push(to);
      const [a, b] = await Promise.all([fs.stat(from), fs.stat(to)]);
      if (a.size !== b.size) throw new Error(`size differs: ${relative(o.from, from)}`);
    }
  };
  try {
    await copyTree(o.from, o.to);
  } catch (error) {
    for (const path of created.reverse()) {
      await fs.rm(path, { recursive: true, force: true }).catch(() => undefined);
    }
    const code = (error as NodeJS.ErrnoException).code;
    return { failed: code ? `${code}: ${String(error)}` : String(error) };
  }
  await fs.rm(o.from, { recursive: true, force: true });
  return 'moved';
}
