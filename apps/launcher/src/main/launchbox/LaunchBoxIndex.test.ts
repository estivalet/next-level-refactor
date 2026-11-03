import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { buildIndex } from './buildIndex.ts';
import { LaunchBoxIndex } from './LaunchBoxIndex.ts';
import { writeFixtureZip } from './testing.ts';

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function built() {
  const temp = await tempDir('nextlevel-launchbox-');
  cleanups.push(temp.cleanup);
  const zip = join(temp.dir, 'Metadata.zip');
  writeFixtureZip(zip);
  const out = join(temp.dir, 'launchbox.db');
  const shares: number[] = [];
  const result = await buildIndex(zip, out, (share) => shares.push(share));
  const index = LaunchBoxIndex.open(out);
  if (!index) throw new Error('index did not open');
  cleanups.push(() => {
    index.close();
  });
  return { index, result, shares, dir: temp.dir };
}

describe('LaunchBox index (FR-SCR-6)', () => {
  it('builds games, alternates and the art types NextLevel uses', async () => {
    const { index, result, shares } = await built();
    expect(result).toEqual({ games: 3 });
    expect(shares.at(-1)).toBe(1);
    expect(index.info()).toMatchObject({ games: 3 });
    expect(index.platforms()).toEqual([
      'Microsoft Xbox 360',
      'Nintendo DS',
      'Nintendo Entertainment System',
    ]);
    expect(index.platformNames('Microsoft Xbox 360')).toEqual([
      { id: 472523, name: 'Ace Driver Collection', norm: 'ace driver collection' },
      { id: 472523, name: 'Ace Driver Trilogy', norm: 'ace driver trilogy' },
    ]);
    expect(index.game(472523)).toMatchObject({ name: 'Ace Driver Collection', year: 2026 });
    expect(index.game(1)).toBeNull();
    expect(index.images(472523)).toHaveLength(4);
    // Arcade - Cabinet is not an art type NextLevel maps.
    expect(index.images(438312).map((image) => image.fileName)).toEqual([
      'dracula-na.jpg',
      'dracula-eu.jpg',
    ]);
  });

  it('open answers null for a missing or unreadable index', async () => {
    const temp = await tempDir('nextlevel-launchbox-');
    cleanups.push(temp.cleanup);
    expect(LaunchBoxIndex.open(join(temp.dir, 'none.db'))).toBeNull();
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(temp.dir, 'junk.db'), 'not a database');
    expect(LaunchBoxIndex.open(join(temp.dir, 'junk.db'))).toBeNull();
  });
});
