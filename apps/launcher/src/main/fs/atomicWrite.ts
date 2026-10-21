import * as fsp from 'node:fs/promises';

export type AtomicFs = Pick<typeof fsp, 'open' | 'rename' | 'rm'>;

/**
 * Writes `data` to `file` so the file is always either the old or the new full content
 * (NFR-REL-1): write `<file>.tmp`, flush it to disk, then rename over the target.
 */
export async function atomicWrite(
  file: string,
  data: string | Uint8Array,
  fs: AtomicFs = fsp,
): Promise<void> {
  const tmp = `${file}.tmp`;
  try {
    const handle = await fs.open(tmp, 'w');
    try {
      await handle.writeFile(data);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmp, file);
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw error;
  }
}
