import { err, ERROR_CODES, ok, type CatalogQuery } from '@nextlevel/shared';
import { getSystem, systemCatalog } from '@nextlevel/system-catalog';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell, type FakeResponses } from '../../test-utils.tsx';
import { CatalogApp } from './CatalogApp.tsx';
import { detail, download, installed, listItem } from './catalogFixtures.ts';

afterEach(() => {
  setBridgeForTests(null);
});

const NES = getSystem('nintendo-nes')?.name ?? 'nintendo-nes';
const GB = getSystem('nintendo-gb')?.name ?? 'nintendo-gb';

const STAR = listItem();
const MOSS = listItem({
  id: 'i2',
  slug: 'moss-garden',
  title: 'Moss Garden',
  systemId: 'nintendo-gb',
  starter: true,
  publishedAt: '2026-10-29T10:00:00.000Z',
});
const ORBIT = listItem({
  id: 'i3',
  slug: 'orbit-drift',
  title: 'Orbit Drift',
  license: { type: 'public-domain', rightsHolder: 'Anon' },
});

const page = (items: (typeof STAR)[]) => ok({ items, nextCursor: null });

function setup(responses: FakeResponses = {}) {
  const bridge = installFakeBridge({
    'systems.catalog': () => ok([...systemCatalog()]),
    'catalog.list': (query: Partial<CatalogQuery>) => {
      if (query.starter === 'true') return page([MOSS]);
      if (query.sort === 'new') return page([MOSS, STAR]);
      return page([MOSS, ORBIT, STAR]);
    },
    'catalog.get': ({ itemId }) => ok(detail({ id: itemId })),
    'catalog.installed': () => ok([]),
    'downloads.list': () => ok([]),
    'launch.running': () => ok(null),
    ...responses,
  });
  renderInShell(<CatalogApp />);
  const listQueries = () =>
    bridge.calls.filter((call) => call.channel === 'catalog.list').map((call) => call.input);
  return { bridge, listQueries };
}

const row = (name: string) => screen.getByRole('list', { name });

describe('Catalog app: Browse (S8, FR-CAT-1, D46, D47)', () => {
  it('rows: Starter set, New, then one row per system', async () => {
    setup();
    expect(await screen.findByRole('list', { name: 'Starter set' })).toBeVisible();
    expect(within(row('Starter set')).getByText('Moss Garden')).toBeVisible();
    expect(
      within(row('New'))
        .getAllByRole('button')
        .map((b) => b.dataset.itemId),
    ).toEqual(['i2', 'i1']);
    expect(within(row(NES)).getByText('Orbit Drift')).toBeVisible();
    expect(within(row(NES)).getByText('Star Hopper')).toBeVisible();
    expect(within(row(GB)).getByText('Moss Garden')).toBeVisible();
  });

  it('D46: the Starter set row is hidden when the plan has no starter items', async () => {
    setup({
      'catalog.list': (query: Partial<CatalogQuery>) =>
        query.starter === 'true' ? page([]) : page([STAR]),
    });
    expect(await screen.findByRole('list', { name: 'New' })).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Starter set' })).toBeNull();
  });

  it('search and system filters ask the catalog and show the results', async () => {
    const u = userEvent.setup();
    const t = setup();
    await screen.findByRole('list', { name: 'New' });
    await u.type(screen.getByRole('searchbox', { name: 'Search the catalog' }), 'orbit');
    await u.selectOptions(screen.getByRole('combobox', { name: 'System' }), 'nintendo-nes');
    await waitFor(() => {
      expect(t.listQueries()).toContainEqual(
        expect.objectContaining({ q: 'orbit', system: 'nintendo-nes' }),
      );
    });
    expect(await screen.findByRole('list', { name: 'Results' })).toBeVisible();
    expect(screen.queryByRole('list', { name: 'New' })).toBeNull();
  });

  it('a card shows art, title, system, size, license and its state', async () => {
    setup({
      'catalog.list': () =>
        page([
          STAR,
          listItem({ id: 'i4', title: 'Queued One', installState: 'queued' }),
          listItem({ id: 'i5', title: 'Fetching One', installState: 'downloading' }),
          listItem({ id: 'i6', title: 'Mine', installState: 'installed' }),
          listItem({ id: 'i7', title: 'Newer', installState: 'update' }),
          listItem({ id: 'i8', title: 'Broken', installState: 'failed' }),
        ]),
      'downloads.list': () =>
        ok([
          download({ id: 'd5', itemId: 'i5', bytesDone: 2048, bytesTotal: 8192 }),
          download({ id: 'd8', itemId: 'i8', state: 'failed', error: 'checksum' }),
        ]),
    });
    const card = (await screen.findAllByRole('button', { name: /Star Hopper/ }))[0] as HTMLElement;
    expect(within(card).getByRole('img')).toHaveAttribute(
      'src',
      'nextlevel://catalog-art/i1/box-front',
    );
    expect(card).toHaveTextContent(NES);
    expect(card).toHaveTextContent('8 KB');
    expect(card).toHaveTextContent('Freeware');
    expect(card).toHaveTextContent('Available');
    const text = (title: string) =>
      (screen.getAllByRole('button', { name: new RegExp(title) })[0] as HTMLElement).textContent;
    expect(text('Queued One')).toContain('Queued');
    expect(text('Fetching One')).toContain('Downloading 25%');
    expect(text('Mine')).toContain('Installed');
    expect(text('Newer')).toContain('Update available');
    expect(text('Broken')).toContain('Download corrupted — retry');
  });

  it('arrow keys move focus across cards and rows', async () => {
    const u = userEvent.setup();
    setup();
    const starter = await screen.findByRole('list', { name: 'Starter set' });
    within(starter).getAllByRole('button')[0]?.focus();
    await u.keyboard('{ArrowDown}');
    expect(document.activeElement?.getAttribute('data-item-id')).toBe('i2');
    expect(within(row('New')).getAllByRole('button')[0]).toHaveFocus();
    await u.keyboard('{ArrowRight}');
    expect(within(row('New')).getAllByRole('button')[1]).toHaveFocus();
    await u.keyboard('{ArrowUp}');
    expect(within(starter).getAllByRole('button')[0]).toHaveFocus();
  });
});

describe('Catalog app: keyboard and gamepad stay where they belong (D47)', () => {
  it('arrow keys in the search box edit the text; they never jump to the cards', async () => {
    const u = userEvent.setup();
    setup();
    await screen.findByRole('list', { name: 'New' });
    const search = screen.getByRole('searchbox', { name: 'Search the catalog' });
    await u.click(search);
    await u.keyboard('sta{ArrowLeft}r');
    expect(search).toHaveFocus();
    // The caret moved left inside the box before the "r".
    expect(search).toHaveValue('stra');
  });

  it('in the detail, arrows move between its buttons and back returns to the card it came from', async () => {
    const u = userEvent.setup();
    setup({ 'catalog.installed': () => ok([installed({ itemId: 'i1' })]) });
    const card = within(await screen.findByRole('list', { name: 'New' })).getAllByRole(
      'button',
    )[1] as HTMLElement;
    card.focus();
    await u.keyboard('{Enter}');
    const panel = await screen.findByRole('region', { name: 'Star Hopper' });
    await within(panel).findByRole('button', { name: 'Play' });
    const install = within(panel).getByRole('button', { name: 'Install' });
    expect(within(panel).getByRole('button', { name: 'Back to the catalog' })).toHaveFocus();
    await u.keyboard('{ArrowRight}');
    expect(install).toHaveFocus();
    await u.keyboard('{Escape}');
    await waitFor(() => {
      expect(document.activeElement?.getAttribute('data-item-id')).toBe('i1');
    });
  });
});

describe('Catalog app: item detail (US-E1, US-E2, US-E3)', () => {
  it('US-E1: the detail credits the license and shows description, screenshots and size; Install queues it', async () => {
    const u = userEvent.setup();
    const t = setup({ 'catalog.install': () => ok(download({ state: 'queued' })) });
    await u.click(
      (await screen.findAllByRole('button', { name: /Orbit Drift/ }))[0] as HTMLElement,
    );
    const panel = await screen.findByRole('region', { name: 'Star Hopper' });
    expect(within(panel).getByText('A tiny space shooter.')).toBeVisible();
    expect(within(panel).getByText('License: Freeware · © Pixel Moth')).toBeVisible();
    expect(within(panel).getByRole('img', { name: 'Screenshot' })).toHaveAttribute(
      'src',
      'nextlevel://catalog-art/i1/screenshot-game-play',
    );
    expect(panel).toHaveTextContent('8 KB');
    await u.click(within(panel).getByRole('button', { name: 'Install' }));
    expect(t.bridge.calls.find((c) => c.channel === 'catalog.install')?.input).toEqual({
      itemId: 'i3',
    });
  });

  it('an installed item offers Play and Uninstall; an update offers Update', async () => {
    const u = userEvent.setup();
    setup({
      'catalog.get': ({ itemId }) => ok(detail({ id: itemId, installState: 'update' })),
      'catalog.installed': () => ok([installed({ itemId: 'i1' })]),
    });
    await u.click(
      (await screen.findAllByRole('button', { name: /Star Hopper/ }))[0] as HTMLElement,
    );
    const panel = await screen.findByRole('region', { name: 'Star Hopper' });
    expect(within(panel).getByRole('button', { name: 'Update' })).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Play' })).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Uninstall' })).toBeVisible();
  });

  it('US-E3: Uninstall asks when the game is a favorite or in a collection', async () => {
    const u = userEvent.setup();
    const t = setup({
      'catalog.get': ({ itemId }) => ok(detail({ id: itemId, installState: 'installed' })),
      'catalog.installed': () => ok([installed()]),
      'catalog.uninstall': ({ confirm }) =>
        confirm
          ? ok(undefined)
          : err('CONFLICT', ERROR_CODES.CONFLICT, { reason: 'inCollections' }),
    });
    await u.click(
      (await screen.findAllByRole('button', { name: /Star Hopper/ }))[0] as HTMLElement,
    );
    await u.click(await screen.findByRole('button', { name: 'Uninstall' }));
    const dialog = await screen.findByRole('dialog', { name: 'Uninstall Star Hopper?' });
    expect(dialog).toHaveTextContent('a favorite or in a collection');
    await u.click(within(dialog).getByRole('button', { name: 'Uninstall' }));
    await waitFor(() => {
      expect(
        t.bridge.calls.filter((c) => c.channel === 'catalog.uninstall').map((c) => c.input),
      ).toEqual([
        { itemId: 'i1', confirm: false },
        { itemId: 'i1', confirm: true },
      ]);
    });
  });
});

describe('Catalog app: offline, Installed, notices (FR-CAT-7, D43)', () => {
  it('offline: the catalog says it needs a connection; Installed still works', async () => {
    const u = userEvent.setup();
    setup({
      'catalog.list': () => err('API_UNREACHABLE', ERROR_CODES.API_UNREACHABLE),
      'catalog.installed': () =>
        ok([installed(), installed({ itemId: 'i9', gameId: 9, title: 'Kept One', state: 'gone' })]),
    });
    expect(
      await screen.findByText('Catalog needs a connection — installed games still play'),
    ).toBeVisible();
    await u.click(screen.getByRole('tab', { name: 'Installed' }));
    const list = await screen.findByRole('list', { name: 'Installed games' });
    expect(within(list).getByText('Star Hopper')).toBeVisible();
    expect(within(list).getByText('No longer in the catalog')).toBeVisible();
  });
});
