import type { ArchiveMode } from '@nextlevel/shared';
import { spawn } from 'node:child_process';
import { readdir, rm, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { launchError } from './errors.ts';

export interface Extractor {
  /** Extracts every file of `archive` into `dest` (created if needed). */
  extract(archive: string, dest: string): Promise<void>;
}

export interface PreparedRom {
  /** The file to launch: the ROM itself, or the chosen file inside the extracted archive. */
  path: string;
  /** Removes the extraction folder; a no-op when nothing was extracted. */
  cleanup(): Promise<void>;
}

const ARCHIVES = new Set(['zip', '7z']);
/** Index files that name the other files of a set, preferred over any single file. */
const INDEX_FILES = ['m3u', 'cue', 'gdi'];

const extensionOf = (path: string) => extname(path).replace(/^\./, '').toLowerCase();

async function filesUnder(dir: string): Promise<Array<{ path: string; size: number }>> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const path = join(entry.parentPath, entry.name);
        return { path, size: (await stat(path)).size };
      }),
  );
}

/** The file to launch from an extracted archive: an index file, else the largest ROM file. */
function pick(files: Array<{ path: string; size: number }>, systemExtensions: readonly string[]) {
  for (const index of INDEX_FILES) {
    const found = files.find((file) => extensionOf(file.path) === index);
    if (found) return found.path;
  }
  const roms = files.filter((file) => {
    const extension = extensionOf(file.path);
    return systemExtensions.includes(extension) && !ARCHIVES.has(extension);
  });
  return roms.sort((a, b) => b.size - a.size)[0]?.path;
}

/** FR-EMU-8: passes the ROM through, or extracts an archive for profiles that can't read it. */
export async function prepareRom(input: {
  romPath: string;
  mode: ArchiveMode;
  systemExtensions: readonly string[];
  dest: string;
  extractor: Extractor;
}): Promise<PreparedRom> {
  if (input.mode === 'pass' || !ARCHIVES.has(extensionOf(input.romPath))) {
    return { path: input.romPath, cleanup: () => Promise.resolve() };
  }
  const cleanup = () => rm(input.dest, { recursive: true, force: true, maxRetries: 5 });
  try {
    await input.extractor.extract(input.romPath, input.dest);
    const path = pick(await filesUnder(input.dest), input.systemExtensions);
    if (!path) throw launchError('LAUNCH_FAILED', { path: input.romPath, reason: 'emptyArchive' });
    return { path, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/** Extracts with the bundled 7-Zip (ADR-014): `7za x -y -o<dest> <archive>`, no shell. */
export function sevenZipExtractor(sevenZipPath: string): Extractor {
  return {
    extract: (archive, dest) =>
      new Promise((resolve, reject) => {
        const child = spawn(sevenZipPath, ['x', '-y', `-o${dest}`, archive], {
          shell: false,
          windowsHide: true,
          stdio: 'ignore',
        });
        child.once('error', reject);
        child.once('close', (code) => {
          if (code === 0) resolve();
          else
            reject(
              launchError('LAUNCH_FAILED', { path: archive, reason: `7-Zip exit ${String(code)}` }),
            );
        });
      }),
  };
}
