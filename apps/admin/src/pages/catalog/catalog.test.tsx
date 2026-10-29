import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPage, stubApi, stubUploads } from '../../test-utils.tsx';
import { CatalogPage } from './CatalogPage.tsx';
import { HASH, SCOPES, item, license, ready, refusal } from './catalogFixtures.ts';
import { ItemEditor } from './ItemEditor.tsx';
import { NewItemPage } from './NewItemPage.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = '';
});

const ITEM = '/v1/admin/catalog/items/i1';

function editor(tab: Parameters<typeof ItemEditor>[0]['tab'], detail: unknown) {
  const calls = stubApi({
    [`GET ${ITEM}`]: () => ({ body: detail }),
    'GET /v1/admin/scopes': () => ({ body: SCOPES }),
  });
  return { calls, ...renderPage(<ItemEditor id="i1" tab={tab} />) };
}

type Item = Record<string, unknown>;

/** The item as the API keeps it: each write changes what the next GET (the refetch) returns. */
function live(
  tab: Parameters<typeof ItemEditor>[0]['tab'],
  initial: Item,
  writes: Record<string, (current: Item, body: unknown) => Item>,
) {
  let current = initial;
  const routes: Parameters<typeof stubApi>[0] = {
    [`GET ${ITEM}`]: () => ({ body: current }),
    'GET /v1/admin/scopes': () => ({ body: SCOPES }),
  };
  for (const [key, write] of Object.entries(writes)) {
    routes[key] = ({ body }) => {
      current = write(current, body);
      return { body: current };
    };
  }
  const calls = stubApi(routes);
  renderPage(<ItemEditor id="i1" tab={tab} />);
  return calls;
}

const sent = (calls: ReturnType<typeof stubApi>, method: string) =>
  calls.find((call) => call.method === method);

describe('Catalog list (S13, FR-ADM-3)', () => {
  it('lists title, system, scope, license state, status and version; New item links to the form', async () => {
    stubApi({
      'GET /v1/admin/catalog/items': () => ({
        body: {
          items: [
            item({ status: 'published', licenseState: 'verified', version: 3 }),
            item({ id: 'i2', slug: 'moss-garden', title: 'Moss Garden', systemId: 'nintendo-gb' }),
          ],
          nextCursor: null,
        },
      }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
    });
    renderPage(<CatalogPage />);
    const table = await screen.findByRole('table', { name: 'Catalog' });
    const star = (await within(table).findByRole('link', { name: 'Star Hopper' })).closest(
      'tr',
    ) as HTMLElement;
    expect(within(star).getByText('Nintendo NES')).toBeVisible();
    expect(within(star).getByText('homebrew-8bit')).toBeVisible();
    expect(within(star).getByText('Verified')).toBeVisible();
    expect(within(star).getByText('Published')).toBeVisible();
    expect(within(star).getByText('3')).toBeVisible();
    const moss = within(table)
      .getByRole('link', { name: 'Moss Garden' })
      .closest('tr') as HTMLElement;
    expect(within(moss).getByText('No license')).toBeVisible();
    expect(within(moss).getByText('Draft')).toBeVisible();
    expect(screen.getByRole('link', { name: 'New item' })).toHaveAttribute('href', '#/catalog/new');
  });

  it('a slug taken on create is explained on the slug field', async () => {
    const u = userEvent.setup();
    const calls = stubApi({
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      'POST /v1/admin/catalog/items': () => refusal('CONFLICT', 'slugTaken'),
    });
    renderPage(<NewItemPage />);
    await u.type(await screen.findByLabelText('Slug'), 'star-hopper');
    await u.type(screen.getByLabelText('Title'), 'Star Hopper');
    await u.selectOptions(screen.getByLabelText('System'), 'nintendo-nes');
    await u.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('This slug is taken.')).toBeVisible();
    expect(screen.getByLabelText('Slug')).toHaveAttribute('aria-invalid', 'true');
    expect(calls.at(-1)?.body).toEqual({
      slug: 'star-hopper',
      title: 'Star Hopper',
      systemId: 'nintendo-nes',
      scopeSlug: 'homebrew-8bit',
    });
  });

  it('a new item opens its editor once created', async () => {
    const u = userEvent.setup();
    stubApi({
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      'POST /v1/admin/catalog/items': () => ({ body: item({ id: 'i9' }) }),
    });
    renderPage(<NewItemPage />);
    await u.type(await screen.findByLabelText('Slug'), 'star-hopper');
    await u.type(screen.getByLabelText('Title'), 'Star Hopper');
    await u.selectOptions(screen.getByLabelText('System'), 'nintendo-nes');
    await u.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(window.location.hash).toBe('#/catalog/i9/metadata');
    });
  });
});

describe('Publish tab (C10, D43, D44, D46)', () => {
  it("C10: Publish is disabled with 'License required' and every other blocker named", async () => {
    editor('publish', item({ publishBlockers: ['license', 'onLapse', 'files'] }));
    const publish = await screen.findByRole('button', { name: 'Publish' });
    expect(publish).toBeDisabled();
    const why = screen.getByRole('list', { name: 'Before publishing' });
    expect(within(why).getByText('License required')).toBeVisible();
    expect(within(why).getByText('Pick what happens when it leaves the catalog')).toBeVisible();
    expect(within(why).getByText('Add a ROM or disc file')).toBeVisible();
  });

  it.each([
    ['licenseUnverified', 'License not verified'],
    ['licenseNotStarted', "License hasn't started yet"],
    ['licenseExpired', 'License expired'],
  ])('the %s blocker is named', async (blocker, text) => {
    editor('publish', item({ publishBlockers: [blocker] }));
    expect(await screen.findByText(text)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  });

  it('a ready item publishes', async () => {
    const u = userEvent.setup();
    live('publish', ready(), {
      [`POST ${ITEM}/publish`]: (current) => ({ ...current, status: 'published' }),
    });
    await u.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Status: Published')).toBeVisible();
  });

  it('On lapse must be picked (Keep/Remove): nothing is picked by default', async () => {
    const u = userEvent.setup();
    const calls = live('publish', item(), {
      [`PATCH ${ITEM}`]: (current, body) => ({ ...current, ...(body as Item) }),
    });
    const keep = await screen.findByRole('radio', { name: /Keep/ });
    const remove = screen.getByRole('radio', { name: /Remove/ });
    expect(keep).not.toBeChecked();
    expect(remove).not.toBeChecked();
    await u.click(remove);
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Remove/ })).toBeChecked();
    });
    expect(sent(calls, 'PATCH')?.body).toEqual({ onLapse: 'remove' });
  });

  it('Starter set toggles', async () => {
    const u = userEvent.setup();
    const calls = live('publish', item(), {
      [`PATCH ${ITEM}`]: (current, body) => ({ ...current, ...(body as Item) }),
    });
    const box = await screen.findByRole('checkbox', { name: 'Starter set' });
    expect(box).not.toBeChecked();
    await u.click(box);
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Starter set' })).toBeChecked();
    });
    expect(sent(calls, 'PATCH')?.body).toEqual({ starter: true });
  });
});

describe('License tab (C10, D44, content policy §4)', () => {
  it('Verify is disabled until evidence is uploaded', async () => {
    editor('license', item({ license: license(), licenseState: 'unverified' }));
    const verify = await screen.findByRole('button', { name: 'Mark verified' });
    expect(verify).toBeDisabled();
    expect(screen.getByText('Upload the evidence first.')).toBeVisible();
  });

  it('with evidence, Verify records who verified it', async () => {
    const u = userEvent.setup();
    const withEvidence = item({ license: license({ evidenceFilename: 'permission.txt' }) });
    live('license', withEvidence, { [`POST ${ITEM}/license/verify`]: () => ready() });
    expect(await screen.findByRole('link', { name: 'permission.txt' })).toHaveAttribute(
      'href',
      `${ITEM}/license/evidence`,
    );
    await u.click(screen.getByRole('button', { name: 'Mark verified' }));
    expect(await screen.findByText(/Verified by admin@nextlevel\.test/)).toBeVisible();
    expect(screen.getByLabelText('Upload evidence')).toBeDisabled();
  });

  it('evidence uploads with its name and type', async () => {
    const u = userEvent.setup();
    const uploads = stubUploads();
    editor('license', item({ license: license() }));
    await u.upload(
      await screen.findByLabelText('Upload evidence'),
      new File(['ok'], 'permission.pdf', { type: 'application/pdf' }),
    );
    await waitFor(() => {
      expect(uploads).toHaveLength(1);
    });
    expect(uploads[0]?.url).toBe(`${ITEM}/license/evidence?filename=permission.pdf`);
    expect(uploads[0]?.headers['content-type']).toBe('application/pdf');
  });

  it('a new license sends the form; dates are UTC days', async () => {
    const u = userEvent.setup();
    const calls = live('license', item(), {
      [`PUT ${ITEM}/license`]: (current) => ({ ...current, license: license() }),
    });
    await u.selectOptions(await screen.findByLabelText('Type'), 'freeware');
    await u.type(screen.getByLabelText('Rights holder'), 'Pixel Moth');
    await u.type(screen.getByLabelText('Contact'), 'moth@example.test');
    await u.type(screen.getByLabelText('Terms'), 'Free to share.');
    await u.type(screen.getByLabelText('Territories'), 'BR, us');
    await u.type(screen.getByLabelText('Expires on'), '2027-12-31');
    await u.click(screen.getByRole('button', { name: 'Save license' }));
    await waitFor(() => {
      expect(sent(calls, 'PUT')).toBeDefined();
    });
    expect(sent(calls, 'PUT')?.body).toEqual({
      type: 'freeware',
      rightsHolder: 'Pixel Moth',
      contact: 'moth@example.test',
      terms: 'Free to share.',
      territories: ['BR', 'US'],
      expiresAt: '2027-12-31T00:00:00.000Z',
    });
  });

  it("replacing a published item's license warns it will be unpublished", async () => {
    const u = userEvent.setup();
    const calls = live('license', ready({ status: 'published' }), {
      [`PUT ${ITEM}/license`]: (current) => ({
        ...current,
        status: 'unpublished',
        license: license({ id: 'l2' }),
      }),
    });
    expect(await screen.findByText(/Saving a new license unpublishes this item/)).toBeVisible();
    await u.clear(screen.getByLabelText('Terms'));
    await u.type(screen.getByLabelText('Terms'), 'New terms.');
    await u.click(screen.getByRole('button', { name: 'Save license' }));
    const dialog = screen.getByRole('dialog', { name: 'Replace the license?' });
    expect(calls.some((call) => call.method === 'PUT')).toBe(false);
    await u.click(within(dialog).getByRole('button', { name: 'Replace and unpublish' }));
    await waitFor(() => {
      expect(sent(calls, 'PUT')?.body).toMatchObject({ terms: 'New terms.' });
    });
  });
});

describe('Metadata and Art tabs (FR-ADM-3)', () => {
  it('Save sends only the changed fields', async () => {
    const u = userEvent.setup();
    const calls = live('metadata', item(), {
      [`PATCH ${ITEM}`]: (current, body) => ({ ...current, ...(body as Item) }),
    });
    const save = await screen.findByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await u.type(screen.getByLabelText('Year'), '2024');
    await u.type(screen.getByLabelText('Genre'), 'Shooter');
    await u.click(save);
    expect(await screen.findByText('Saved.')).toBeVisible();
    expect(sent(calls, 'PATCH')?.body).toEqual({ year: 2024, genre: 'Shooter' });
  });

  it("D43: a published item's scope change asks first (players outside it lose the game)", async () => {
    const u = userEvent.setup();
    const calls = stubApi({
      [`GET ${ITEM}`]: () => ({ body: ready({ status: 'published', onLapse: 'remove' }) }),
      'GET /v1/admin/scopes': () => ({
        body: [...SCOPES, { id: 's2', slug: 'premium', name: 'Premium', description: '' }],
      }),
      [`PATCH ${ITEM}`]: () => ({ body: ready({ status: 'published', scopeSlug: 'premium' }) }),
    });
    renderPage(<ItemEditor id="i1" tab="metadata" />);
    await screen.findByRole('option', { name: 'Premium' });
    await u.selectOptions(screen.getByLabelText('Scope'), 'premium');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = screen.getByRole('dialog', { name: 'Change the scope?' });
    expect(dialog).toHaveTextContent('Remove');
    expect(sent(calls, 'PATCH')).toBeUndefined();
    await u.click(within(dialog).getByRole('button', { name: 'Change scope' }));
    await waitFor(() => {
      expect(sent(calls, 'PATCH')?.body).toEqual({ scopeSlug: 'premium' });
    });
  });

  it('art lists every kind; an upload sends the image type', async () => {
    const u = userEvent.setup();
    const uploads = stubUploads();
    editor('art', item({ media: [{ kind: 'box-front', size: 2048, sha256: HASH, version: 2 }] }));
    const row = (await screen.findByText('Box front')).closest('tr') as HTMLElement;
    expect(within(row).getByText('2 KB · version 2')).toBeVisible();
    const marquee = screen.getByText('Marquee').closest('tr') as HTMLElement;
    expect(within(marquee).getByText('None')).toBeVisible();
    await u.upload(
      screen.getByLabelText('Upload Marquee'),
      new File(['png'], 'marquee.png', { type: 'image/png' }),
    );
    await waitFor(() => {
      expect(uploads).toHaveLength(1);
    });
    expect(uploads[0]?.url).toBe(`${ITEM}/media/marquee`);
    expect(uploads[0]?.headers['content-type']).toBe('image/png');
  });
});
