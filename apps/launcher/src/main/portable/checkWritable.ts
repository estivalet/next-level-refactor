import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Writable = { ok: true } | { ok: false; reason: 'readOnly' | 'missing' };

/**
 * Whether the launcher can write its data folder (e.g. not under Program Files): creates it,
 * writes and removes `.write-test`. `missing`: the folder can't be created.
 */
export async function checkWritable(
  dir: string,
  io: { write?: (file: string) => Promise<void> } = {},
): Promise<Writable> {
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    return { ok: false, reason: 'missing' };
  }
  const file = join(dir, '.write-test');
  try {
    await (io.write ?? ((path: string) => writeFile(path, 'ok')))(file);
    await rm(file, { force: true });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'readOnly' };
  }
}
