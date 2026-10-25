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
