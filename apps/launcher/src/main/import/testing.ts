import { cp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempDir } from '../library/testing.ts';

/** The invented NextLevelOS install used by importer tests (test strategy C5). */
export const LEGACY_FIXTURE = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'test',
  'fixtures',
  'nextlevelos',
);

/**
 * Copies the fixture to `dir` and points its storage paths there (`%FIXTURE%` in config.json).
 * Returns the copy's `data` folder, the one the importer is given.
 */
export async function materializeFixture(dir: string): Promise<string> {
  await cp(LEGACY_FIXTURE, dir, { recursive: true });
  const configPath = join(dir, 'data', 'config.json');
  const config = await readFile(configPath, 'utf8');
  await writeFile(configPath, config.replaceAll('%FIXTURE%', dir.replaceAll('\\', '/')));
  return join(dir, 'data');
}

export interface LegacyCopy {
  /** The temp folder holding `data/` and `roms/`. */
  root: string;
  /** The copy's `data` folder. */
  data: string;
  cleanup: () => Promise<void>;
}

/** A fresh fixture copy in a temp folder. */
export async function legacyCopy(): Promise<LegacyCopy> {
  const temp = await tempDir('nextlevel-import-');
  return { root: temp.dir, data: await materializeFixture(temp.dir), cleanup: temp.cleanup };
}
