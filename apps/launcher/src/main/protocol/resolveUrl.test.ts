import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseNextlevelUrl } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { resolveNextlevelPath, type ResolveDeps } from './resolveUrl.ts';

let root: string;
let cleanup: () => Promise<void>;
let deps: ResolveDeps;

beforeEach(async () => {
  ({ dir: root, cleanup } = await tempDir('nextlevel-resolve-'));
  await mkdir(join(root, 'assets', 'logo', 'clear'), { recursive: true });
  await mkdir(join(root, 'themes', 'big-box', 'video'), { recursive: true });
  await writeFile(join(root, 'assets', 'logo', 'clear', 'Sega Saturn.png'), 'x');
  await writeFile(join(root, 'themes', 'big-box', 'video', 'Arcade.mp4'), 'x');
  await writeFile(join(root, 'secret.txt'), 'x');
  deps = {
    mediaPath: (gameId, kind) => (gameId === 7 && kind === 'box-front' ? 'E:\\m\\7.png' : null),
    assetsPath: join(root, 'assets'),
    themesPath: join(root, 'themes'),
  };
});
afterEach(async () => {
  await cleanup();
});

const resolve = (url: string, override: Partial<ResolveDeps> = {}) => {
  const parsed = parseNextlevelUrl(url);
  if (!parsed) throw new Error(`unparsable ${url}`);
  return resolveNextlevelPath(parsed, { ...deps, ...override });
};

describe('resolveNextlevelPath', () => {
  it('FR-THM-6: art in the assets folder and a theme pack resolves, spaces included', async () => {
    expect(await resolve('nextlevel://art/assets/logo/clear/Sega%20Saturn.png')).toBe(
      join(root, 'assets', 'logo', 'clear', 'Sega Saturn.png'),
    );
    expect(await resolve('nextlevel://art/pack/big-box/video/Arcade.mp4')).toBe(
      join(root, 'themes', 'big-box', 'video', 'Arcade.mp4'),
    );
  });

  it('FR-THM-6: game media comes from the index; unindexed kinds are null', async () => {
    expect(await resolve('nextlevel://media/7/box-front')).toBe('E:\\m\\7.png');
    expect(await resolve('nextlevel://media/7/video')).toBeNull();
  });

  it('FR-THM-6: missing files, unset folders and other packs are null', async () => {
    expect(await resolve('nextlevel://art/assets/logo/clear/Nope.png')).toBeNull();
    expect(await resolve('nextlevel://art/assets/x.png', { assetsPath: null })).toBeNull();
    expect(await resolve('nextlevel://art/pack/ps5/video/Arcade.mp4')).toBeNull();
  });

  it('FR-THM-6: a link inside the art folder that points outside it is refused', async () => {
    const realpath = (path: string) =>
      Promise.resolve(path.endsWith('escape.png') ? join(root, 'secret.txt') : path);
    expect(await resolve('nextlevel://art/assets/escape.png', { realpath })).toBeNull();
  });

  it('FR-THM-6: a folder is not a file', async () => {
    expect(await resolve('nextlevel://art/assets/logo')).toBeNull();
  });
});
