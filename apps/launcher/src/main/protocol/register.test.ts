import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { createNextlevelHandler, NEXTLEVEL_SCHEME } from './register.ts';

let root: string;
let cleanup: () => Promise<void>;
let handle: (request: Request) => Promise<Response>;

beforeEach(async () => {
  ({ dir: root, cleanup } = await tempDir('nextlevel-protocol-'));
  await mkdir(join(root, 'assets', 'logo', 'clear'), { recursive: true });
  await writeFile(join(root, 'assets', 'logo', 'clear', 'Arcade.png'), 'logo');
  await writeFile(join(root, 'win.ini'), 'secret');
  handle = createNextlevelHandler({
    mediaPath: () => null,
    paths: () => ({ assetsPath: join(root, 'assets'), themesPath: null }),
  });
});
afterEach(async () => {
  await cleanup();
});

describe('nextlevel:// handler', () => {
  it('FR-SCR-1: serves a scrape candidate thumbnail from main; unknown is 404', async () => {
    const thumbs = createNextlevelHandler({
      mediaPath: () => null,
      paths: () => ({ assetsPath: null, themesPath: null }),
      scrapeThumb: (id) =>
        Promise.resolve(id === 7 ? { bytes: Buffer.from('thumb'), mime: 'image/jpeg' } : null),
    });
    const res = await thumbs(new Request('nextlevel://scrape-thumb/7'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(await res.text()).toBe('thumb');
    expect((await thumbs(new Request('nextlevel://scrape-thumb/8'))).status).toBe(404);
  });

  it('S8: serves catalog art that main fetched; unknown is 404', async () => {
    const art = createNextlevelHandler({
      mediaPath: () => null,
      paths: () => ({ assetsPath: null, themesPath: null }),
      catalogArt: (itemId, kind) =>
        Promise.resolve(
          itemId === 'i1' && kind === 'box-front'
            ? { bytes: Buffer.from('png'), mime: 'image/png' }
            : null,
        ),
    });
    const res = await art(new Request('nextlevel://catalog-art/i1/box-front'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(await res.text()).toBe('png');
    expect((await art(new Request('nextlevel://catalog-art/i2/box-front'))).status).toBe(404);
  });

  it('FR-MUS-4: nextlevel://remote-image serves the cached bytes with the image type; malformed is 404', async () => {
    const seen: string[] = [];
    const images = createNextlevelHandler({
      mediaPath: () => null,
      paths: () => ({ assetsPath: null, themesPath: null }),
      remoteImage: (url) => {
        seen.push(url);
        return Promise.resolve(
          url === 'https://example.com/a.png'
            ? { bytes: Buffer.from('png'), mime: 'image/png' }
            : null,
        );
      },
    });
    const encode = (url: string) =>
      `nextlevel://remote-image/${Buffer.from(url).toString('base64url')}`;
    const res = await images(new Request(encode('https://example.com/a.png')));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(await res.text()).toBe('png');
    expect((await images(new Request(encode('https://example.com/b.png')))).status).toBe(404);
    expect((await images(new Request(encode('http://example.com/a.png')))).status).toBe(404);
    expect((await images(new Request('nextlevel://remote-image/%%%'))).status).toBe(404);
    expect(seen).toEqual(['https://example.com/a.png', 'https://example.com/b.png']);
  });

  it('FR-SCR-5: a versioned media URL serves the indexed file', async () => {
    const media = createNextlevelHandler({
      mediaPath: (id, kind) => (id === 3 && kind === 'box-front' ? join(root, 'win.ini') : null),
      paths: () => ({ assetsPath: null, themesPath: null }),
    });
    const res = await media(new Request('nextlevel://media/3/box-front?v=12'));
    expect(res.status).toBe(200);
  });

  it('FR-THM-6: serves art from the assets folder', async () => {
    const res = await handle(new Request('nextlevel://art/assets/logo/clear/Arcade.png'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('logo');
  });

  it('FR-THM-6: traversal attempts are 404 and never read outside the root', async () => {
    for (const url of [
      'nextlevel://art/assets/..%2Fwin.ini',
      'nextlevel://art/assets/..%5Cwin.ini',
      'nextlevel://art/assets/logo/..%2F..%2Fwin.ini',
      'nextlevel://art/pack/..%2F..%2Fx/win.ini',
    ]) {
      const res = await handle(new Request(url));
      expect(res.status, url).toBe(404);
    }
  });

  it('FR-THM-6: the renderer may fetch it: CORS-enabled scheme, responses allow any origin', async () => {
    expect(NEXTLEVEL_SCHEME.privileges).toMatchObject({ corsEnabled: true, supportFetchAPI: true });
    const res = await handle(new Request('nextlevel://art/assets/logo/clear/Arcade.png'));
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const missing = await handle(new Request('nextlevel://art/assets/nope.png'));
    expect(missing.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('FR-THM-6: only GET is allowed', async () => {
    const res = await handle(
      new Request('nextlevel://art/assets/logo/clear/Arcade.png', { method: 'POST' }),
    );
    expect(res.status).toBe(405);
  });
});

describe('nextlevel://museum-image', () => {
  it('FR-MUS-8: nextlevel://museum-image serves the stored file; traversal and unknown names 404', async () => {
    const file = '00000000-0000-4000-8000-000000000001.png';
    const seen: string[] = [];
    const museum = createNextlevelHandler({
      mediaPath: () => null,
      paths: () => ({ assetsPath: null, themesPath: null }),
      museumImage: (systemId, name) => {
        seen.push(`${systemId}/${name}`);
        return Promise.resolve(systemId === 'snes' && name === file ? join(root, 'win.ini') : null);
      },
    });
    const ok = await museum(new Request(`nextlevel://museum-image/snes/${file}`));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('secret');
    for (const url of [
      `nextlevel://museum-image/nes/${file}`,
      'nextlevel://museum-image/snes/11111111-1111-4111-8111-111111111111.png',
      'nextlevel://museum-image/snes/..%2Fwin.ini',
      'nextlevel://museum-image/%2e%2e/' + file,
      `nextlevel://museum-image/snes/%2e%2e%2f${file}`,
      `nextlevel://museum-image/snes%5C..%5Cx/${file}`,
      `nextlevel://museum-image/snes/..%5C${file}`,
      'nextlevel://museum-image/snes/notes.png',
      `nextlevel://museum-image/snes/${file}/extra`,
    ]) {
      expect((await museum(new Request(url))).status, url).toBe(404);
    }
    expect(seen).toEqual([
      'snes/' + file,
      'nes/' + file,
      'snes/11111111-1111-4111-8111-111111111111.png',
    ]);
  });
});
