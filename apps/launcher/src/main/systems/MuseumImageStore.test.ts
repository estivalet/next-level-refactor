import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSEUM_IMAGE_MAX_BYTES } from '@nextlevel/shared';
import { tempDir } from '../library/testing.ts';
import { MuseumImageStore } from './MuseumImageStore.ts';

let dir: string;
let cleanup: () => Promise<void>;
let counter: number;
const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
const store = (extra: Partial<ConstructorParameters<typeof MuseumImageStore>[0]> = {}) =>
  new MuseumImageStore({ root: join(dir, 'museum'), newId, ...extra });

beforeEach(async () => {
  counter = 0;
  ({ dir, cleanup } = await tempDir('nextlevel-museum-'));
  await mkdir(join(dir, 'src'));
});
afterEach(async () => {
  await cleanup();
});

describe('MuseumImageStore', () => {
  it('FR-MUS-8: add copies a png into <root>/<systemId>/<uuid>.png and returns its file name', async () => {
    const source = join(dir, 'src', 'cart.png');
    await writeFile(source, 'png-bytes');
    const { added, rejected } = await store().add('snes', [source]);
    expect(rejected).toEqual([]);
    expect(added).toEqual([{ file: '00000000-0000-4000-8000-000000000001.png' }]);
    expect(await readdir(join(dir, 'museum', 'snes'))).toEqual([added[0]?.file]);
  });

  it("FR-MUS-8: add rejects .bmp as 'type', a 20 MB + 1 byte file as 'size', a missing path as 'unreadable', and still adds the valid ones", async () => {
    const bmp = join(dir, 'src', 'a.bmp');
    const big = join(dir, 'src', 'big.png');
    const ok = join(dir, 'src', 'ok.webp');
    await writeFile(bmp, 'x');
    await writeFile(big, Buffer.alloc(MUSEUM_IMAGE_MAX_BYTES + 1));
    await writeFile(ok, 'x');
    const { added, rejected } = await store().add('snes', [
      bmp,
      big,
      join(dir, 'src', 'missing.png'),
      ok,
    ]);
    expect(rejected).toEqual([
      { name: 'a.bmp', reason: 'type' },
      { name: 'big.png', reason: 'size' },
      { name: 'missing.png', reason: 'unreadable' },
    ]);
    expect(added.map((image) => image.file.split('.').pop())).toEqual(['webp']);
  });

  it('FR-MUS-8: add uppercase .JPG stores .jpg', async () => {
    const source = join(dir, 'src', 'PHOTO.JPG');
    await writeFile(source, 'x');
    const { added } = await store().add('snes', [source]);
    expect(added[0]?.file.endsWith('.jpg')).toBe(true);
  });

  it("FR-MUS-8: a failed copy (a write-side error) is rejected as 'copy' and leaves no file and no .tmp behind", async () => {
    const source = join(dir, 'src', 'cart.png');
    await writeFile(source, 'x');
    const failing = store({
      fs: {
        copyFile: async (from, to) => {
          await copyFile(from, to);
          throw new Error('disk full');
        },
      },
    });
    const { added, rejected } = await failing.add('snes', [source]);
    expect(added).toEqual([]);
    expect(rejected).toEqual([{ name: 'cart.png', reason: 'copy' }]);
    expect(await readdir(join(dir, 'museum', 'snes'))).toEqual([]);
  });

  it("FR-MUS-8: path returns null for a file that doesn't exist or a name not matching MUSEUM_IMAGE_FILE", async () => {
    const source = join(dir, 'src', 'cart.png');
    await writeFile(source, 'x');
    const s = store();
    const { added } = await s.add('snes', [source]);
    const file = added[0]?.file ?? '';
    expect(await s.path('snes', file)).toBe(join(dir, 'museum', 'snes', file));
    expect(await s.path('snes', '11111111-1111-4111-8111-111111111111.png')).toBeNull();
    expect(await s.path('snes', '../snes/' + file)).toBeNull();
    expect(await s.path('snes', 'notes.txt')).toBeNull();
    expect(await s.path('..', file)).toBeNull();
    expect(await s.path('snes/../snes', file)).toBeNull();
  });

  it('FR-MUS-8: keepOnly deletes unreferenced files and leaves the referenced ones', async () => {
    const a = join(dir, 'src', 'a.png');
    const b = join(dir, 'src', 'b.png');
    await writeFile(a, 'a');
    await writeFile(b, 'b');
    const s = store();
    const { added } = await s.add('snes', [a, b]);
    const keep = added[0]?.file ?? '';
    await s.keepOnly('snes', [keep]);
    expect(await readdir(join(dir, 'museum', 'snes'))).toEqual([keep]);
  });

  it('FR-MUS-8: keepOnly keeps going when one file cannot be removed', async () => {
    const a = join(dir, 'src', 'a.png');
    const b = join(dir, 'src', 'b.png');
    await writeFile(a, 'a');
    await writeFile(b, 'b');
    const warn = vi.fn();
    const first = store();
    const { added } = await first.add('snes', [a, b]);
    const [locked, other] = [added[0]?.file ?? '', added[1]?.file ?? ''];
    const s = store({
      log: { warn },
      fs: {
        rm: (async (path: string, options?: object) => {
          if (path.endsWith(locked)) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
          await rm(path, options);
        }) as typeof rm,
      },
    });
    await s.keepOnly('snes', []);
    expect(await readdir(join(dir, 'museum', 'snes'))).toEqual([locked]);
    expect(other).not.toBe(locked);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('FR-MUS-8: keepOnly leaves in-progress .tmp files alone', async () => {
    const folder = join(dir, 'museum', 'snes');
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, '00000000-0000-4000-8000-000000000009.png.tmp'), 'x');
    await writeFile(join(folder, '00000000-0000-4000-8000-000000000008.png'), 'x');
    await store().keepOnly('snes', []);
    expect(await readdir(folder)).toEqual(['00000000-0000-4000-8000-000000000009.png.tmp']);
  });

  it('FR-MUS-8: keepOnly on a system with no folder is a no-op', async () => {
    await expect(store().keepOnly('nes', [])).resolves.toBeUndefined();
    await expect(stat(join(dir, 'museum', 'nes'))).rejects.toThrow();
  });
});
