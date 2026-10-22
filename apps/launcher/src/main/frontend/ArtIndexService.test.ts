import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { perfBudget, tempDir } from '../library/testing.ts';
import { ArtIndexService } from './ArtIndexService.ts';

let root: string;
let cleanup: () => Promise<void>;
let paths: { assetsPath: string | null; themesPath: string | null };
let service: ArtIndexService;

beforeEach(async () => {
  ({ dir: root, cleanup } = await tempDir('nextlevel-art-'));
  paths = { assetsPath: join(root, 'assets'), themesPath: join(root, 'themes') };
  service = new ArtIndexService({ paths: () => paths });
});
// Removing the 20k files of the perf test takes longer than the default hook timeout on CI.
afterEach(async () => {
  await cleanup();
}, 60_000);

async function write(rel: string, content = 'x') {
  const path = join(root, ...rel.split('/'));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

describe('ArtIndexService', () => {
  it('FR-THM-2: lists pack and shared art with / paths, skipping the unsorted folder', async () => {
    await write('assets/logo/clear/Sega Saturn.png');
    await write('assets/background/wallpaper/Arcade.jpg');
    await write('assets/_UNSORTED_DO_NOT_DELETE/logo/x.png');
    await write('themes/big-box/video/Arcade.mp4');
    await write('themes/big-box/theme.json', JSON.stringify({ id: 'big-box', fallback: false }));
    const index = await service.index('big-box');
    expect(index.assetsFiles.sort()).toEqual([
      'background/wallpaper/Arcade.jpg',
      'logo/clear/Sega Saturn.png',
    ]);
    expect(index.packFiles).toEqual(['video/Arcade.mp4']);
    expect(index.manifest).toEqual({ id: 'big-box', fallback: false });
    expect(index.warnings).toEqual([]);
  });

  it('FR-THM-2: files deeper than four levels are not art', async () => {
    await write('assets/a/b/c/d.png');
    await write('assets/a/b/c/d/e.png');
    expect((await service.index('big-box')).assetsFiles).toEqual(['a/b/c/d.png']);
  });

  it('FR-THM-2: an invalid theme.json is ignored with a warning', async () => {
    await write('assets/logo/clear/A.png');
    await write('themes/ps5/theme.json', '{ not json');
    await write('themes/hyperspin/theme.json', JSON.stringify({ id: 'other' }));
    expect(await service.index('ps5')).toMatchObject({
      manifest: null,
      warnings: [{ code: 'manifestInvalidJson' }],
    });
    expect((await service.index('hyperspin')).manifest).toBeNull();
  });

  it('FR-THM-2: no pack, no folders set, or a missing art folder never throw', async () => {
    expect(await service.index('big-box')).toEqual({
      packFiles: [],
      assetsFiles: [],
      manifest: null,
      warnings: [{ code: 'folderUnreadable' }],
    });
    paths = { assetsPath: null, themesPath: null };
    expect(await service.index('big-box')).toEqual({
      packFiles: [],
      assetsFiles: [],
      manifest: null,
      warnings: [],
    });
  });

  it('FR-THM-2: a missing art folder is not cached, so a drive mounted later is seen', async () => {
    expect((await service.index('big-box')).warnings).toEqual([{ code: 'folderUnreadable' }]);
    await write('assets/logo/clear/A.png');
    expect(await service.index('big-box')).toMatchObject({
      assetsFiles: ['logo/clear/A.png'],
      warnings: [],
    });
  });

  it('FR-THM-2: results are cached until refresh or a path change', async () => {
    await write('assets/logo/clear/A.png');
    expect((await service.index('big-box')).assetsFiles).toEqual(['logo/clear/A.png']);
    await write('assets/logo/clear/B.png');
    expect((await service.index('big-box')).assetsFiles).toEqual(['logo/clear/A.png']);
    expect((await service.index('big-box', { refresh: true })).assetsFiles.sort()).toEqual([
      'logo/clear/A.png',
      'logo/clear/B.png',
    ]);
    paths = { ...paths, assetsPath: join(root, 'themes') };
    expect((await service.index('big-box')).assetsFiles).toEqual([]);
  });

  it('NFR-PERF-1: indexing 20k art files stays within budget', async () => {
    const dir = join(root, 'assets', 'logo', 'clear');
    await mkdir(dir, { recursive: true });
    for (let batch = 0; batch < 20; batch += 1) {
      await Promise.all(
        Array.from({ length: 1000 }, (_, i) =>
          writeFile(join(dir, `System ${String(batch * 1000 + i)}.png`), ''),
        ),
      );
    }
    const start = performance.now();
    const index = await service.index('big-box');
    expect(index.assetsFiles).toHaveLength(20_000);
    expect(performance.now() - start).toBeLessThanOrEqual(perfBudget(500));
  }, 60_000);
});
