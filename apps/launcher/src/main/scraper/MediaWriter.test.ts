import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { appErrorOfAsync, tempDir } from '../library/testing.ts';
import { MediaWriter } from './MediaWriter.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

const png = (bytes: Buffer) => Buffer.concat([Buffer.from('PNG:'), bytes]);

async function setup(toPng: (bytes: Buffer) => Buffer | null = png) {
  const temp = await tempDir('nextlevel-media-');
  cleanups.push(temp.cleanup);
  const dir = join(temp.dir, 'Super Nintendo', 'media');
  return { dir, writer: new MediaWriter({ toPng }) };
}

describe('MediaWriter (FR-SCR-4, D17)', () => {
  it('awkward stems are written verbatim as the scan matches them', async () => {
    const { dir, writer } = await setup();
    for (const stem of ['Foo (USA) [!]', "Bär & Co.'s", 'trailing.', 'x']) {
      await writer.write(dir, 'box-front', stem, Buffer.from('img'), 'png');
    }
    expect((await readdir(join(dir, 'box-front'))).sort()).toEqual(
      ["Bär & Co.'s.png", 'Foo (USA) [!].png', 'trailing..png', 'x.png'].sort(),
    );
  });

  it('a JPEG box is transcoded to .png; a PNG is written as it is', async () => {
    const { dir, writer } = await setup();
    const jpg = await writer.write(dir, 'box-front', 'Game', Buffer.from('jpeg'), 'jpg');
    expect(jpg.path).toBe(join(dir, 'box-front', 'Game.png'));
    expect(await readFile(jpg.path, 'utf8')).toBe('PNG:jpeg');
    const asIs = await writer.write(dir, 'logo-clear', 'Game', Buffer.from('pngbytes'), 'png');
    expect(await readFile(asIs.path, 'utf8')).toBe('pngbytes');
  });

  it('fanart keeps JPEG as .jpg; video is .mp4', async () => {
    const { dir, writer } = await setup();
    const fanart = await writer.write(dir, 'fanart', 'Game', Buffer.from('jpeg'), 'jpg');
    expect(fanart.path).toBe(join(dir, 'fanart', 'Game.jpg'));
    expect(await readFile(fanart.path, 'utf8')).toBe('jpeg');
    const video = await writer.write(dir, 'video', 'Game', Buffer.from('movie'), 'mp4');
    expect(video.path).toBe(join(dir, 'video', 'Game.mp4'));
  });

  it('an image that cannot be decoded keeps its bytes under .png', async () => {
    const { dir, writer } = await setup(() => null);
    const result = await writer.write(dir, 'box-front', 'Game', Buffer.from('webp?'), 'webp');
    expect(result.path).toBe(join(dir, 'box-front', 'Game.png'));
    expect(await readFile(result.path, 'utf8')).toBe('webp?');
  });

  it('returns size and version (file mtime ms) and leaves no temp folder', async () => {
    const { dir, writer } = await setup();
    const result = await writer.write(dir, 'box-front', 'Game', Buffer.from('12345'), 'png');
    const info = await stat(result.path);
    expect(result).toEqual({
      path: result.path,
      size: 5,
      version: Math.trunc(info.mtimeMs),
      replaced: [result.path],
    });
    expect(await readdir(dir)).toEqual(['box-front']);
  });

  it('other files with the same stem are removed after the new one lands', async () => {
    const { dir, writer } = await setup();
    await mkdir(join(dir, 'box-front'), { recursive: true });
    await writeFile(join(dir, 'box-front', 'game.jpg'), 'old');
    await writeFile(join(dir, 'box-front', 'GAME.webp'), 'old');
    await writeFile(join(dir, 'box-front', 'Game (Alt).jpg'), 'keep');
    const result = await writer.write(dir, 'box-front', 'Game', Buffer.from('new'), 'png');
    expect((await readdir(join(dir, 'box-front'))).sort()).toEqual(['Game (Alt).jpg', 'Game.png']);
    expect(result.replaced.slice(1).sort()).toEqual(
      [join(dir, 'box-front', 'GAME.webp'), join(dir, 'box-front', 'game.jpg')].sort(),
    );
  });

  it('a failed write throws and leaves the old file and no temp files', async () => {
    const { dir, writer } = await setup();
    await mkdir(join(dir, 'box-front', 'Game.png'), { recursive: true });
    await writeFile(join(dir, 'box-front', 'Game.jpg'), 'old');
    await expect(
      writer.write(dir, 'box-front', 'Game', Buffer.from('new'), 'png'),
    ).rejects.toThrow();
    expect(await readFile(join(dir, 'box-front', 'Game.jpg'), 'utf8')).toBe('old');
    expect((await readdir(dir)).sort()).toEqual(['box-front']);
  });

  it('a stem that is empty or holds a path separator is refused', async () => {
    const { dir, writer } = await setup();
    for (const stem of ['', 'a/b', 'a\\b', '..']) {
      const error = await appErrorOfAsync(() =>
        writer.write(dir, 'box-front', stem, Buffer.from('x'), 'png'),
      );
      expect(error.code, stem).toBe('VALIDATION_FAILED');
    }
  });
});
