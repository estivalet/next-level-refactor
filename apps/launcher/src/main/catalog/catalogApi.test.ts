import type { CatalogItemSummary, DownloadSummary } from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogInstallRepository } from '../library/CatalogInstallRepository.ts';
import { appErrorOfAsync } from '../library/testing.ts';
import { createCatalogApi } from './catalogApi.ts';
import { installWorld } from './installWorld.ts';
import { ItemLocks } from './itemLocks.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0).reverse()) await close();
});

const summary = (id: string, version = 1): CatalogItemSummary => ({
  id,
  slug: id,
  title: `Game ${id}`,
  systemId: 'nintendo-nes',
  scope: 'homebrew-8bit',
  year: null,
  genre: '',
  size: 10,
  license: { type: 'freeware', rightsHolder: 'Pixel Moth' },
  starter: false,
  version,
  publishedAt: null,
  boxArt: null,
});

const download = (itemId: string, state: DownloadSummary['state']): DownloadSummary => ({
  id: `d-${itemId}`,
  itemId,
  title: itemId,
  systemId: 'nintendo-nes',
  version: 1,
  state,
  pausedReason: null,
  bytesDone: 0,
  bytesTotal: 10,
  error: state === 'failed' ? 'network' : null,
  createdAt: '2026-10-29T10:00:00.000Z',
});

async function setup(downloads: DownloadSummary[]) {
  const w = await installWorld(closers);
  const uninstalls: string[] = [];
  const fetched: string[] = [];
  const api = createCatalogApi({
    client: {
      list: () =>
        Promise.resolve({
          items: ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'].map((id) => ({
            ...summary(id, id === 'i3' ? 2 : 1),
            boxArt: id === 'i1' ? `https://api.test/v1/files/box-${id}` : null,
          })),
          nextCursor: null,
        }),
      get: (itemId) =>
        Promise.resolve(
          w.item({
            id: itemId,
            media: [
              { kind: 'screenshot-game-play', url: `https://api.test/v1/files/shot-${itemId}` },
            ],
          }),
        ),
    },
    downloads: {
      list: () => downloads,
      install: (itemId) => Promise.resolve(download(itemId, 'queued')),
      pause: () => Promise.resolve(),
      resume: () => Promise.resolve(),
      cancel: () => Promise.resolve(),
      cancelItem: (itemId) => {
        uninstalls.push(`cancel ${itemId}`);
        return Promise.resolve();
      },
    },
    installer: {
      uninstall: (itemId, confirm) => {
        uninstalls.push(`${itemId}:${String(confirm)}`);
        return w.installer.uninstall(itemId, confirm);
      },
    },
    installs: new CatalogInstallRepository(w.db),
    locks: new ItemLocks(),
    fetchArt: (url) => {
      fetched.push(url);
      return Promise.resolve({ bytes: Buffer.from('png'), format: 'png' });
    },
  });
  const installItem = async (id: string, slug: string) => {
    const item = w.item({ id, slug });
    await w.installer.install(item, await w.download(item, {}));
  };
  return { ...w, api, uninstalls, installItem, fetched };
}

describe('catalog channels behind the IPC (FR-CAT-1..7, US-E1..E3)', () => {
  it('each listed item says where it stands on this PC', async () => {
    const t = await setup([
      download('i4', 'downloading'),
      download('i5', 'queued'),
      download('i6', 'failed'),
    ]);
    await t.installItem('i1', 'one');
    await t.installItem('i3', 'three');
    await t.installItem('i2', 'two');
    t.db.$client
      .prepare("update catalog_installs set state = 'gone' where catalog_item_id = 'i2'")
      .run();
    const page = await t.api.list({ limit: 50 });
    expect(Object.fromEntries(page.items.map((item) => [item.id, item.installState]))).toEqual({
      i1: 'installed',
      i2: 'gone',
      i3: 'update',
      i4: 'downloading',
      i5: 'queued',
      i6: 'failed',
    });
  });

  it('S8: art goes to the renderer as nextlevel://catalog-art URLs; main fetches the signed one', async () => {
    const t = await setup([]);
    const page = await t.api.list({ limit: 50 });
    expect(page.items[0]?.boxArt).toBe('nextlevel://catalog-art/i1/box-front');
    expect(page.items[1]?.boxArt).toBeNull();
    const detail = await t.api.get('i1');
    expect(detail.media).toEqual([
      { kind: 'screenshot-game-play', url: 'nextlevel://catalog-art/i1/screenshot-game-play' },
    ]);
    expect(await t.api.art('i1', 'box-front')).toEqual({
      bytes: Buffer.from('png'),
      mime: 'image/png',
    });
    expect(t.fetched).toEqual(['https://api.test/v1/files/box-i1']);
    expect(await t.api.art('i9', 'box-front')).toBeNull();
  });

  it('installed lists the installs with title, version and state', async () => {
    const t = await setup([]);
    await t.installItem('i1', 'one');
    expect(t.api.installed()).toEqual([
      expect.objectContaining({
        itemId: 'i1',
        title: 'Star Hopper',
        version: 1,
        state: 'current',
        onLapse: 'keep',
      }),
    ]);
  });

  it('uninstall goes through the installer under the item lock; an unknown item is NOT_FOUND', async () => {
    const t = await setup([]);
    await t.installItem('i1', 'one');
    await t.api.uninstall('i1', false);
    // Its active download (an Update) is cancelled first, so it can't reinstall afterwards.
    expect(t.uninstalls).toEqual(['cancel i1', 'i1:false']);
    expect((await appErrorOfAsync(() => t.api.uninstall('i1', false))).code).toBe('NOT_FOUND');
  });
});
