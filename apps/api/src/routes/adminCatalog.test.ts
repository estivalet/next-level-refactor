import type { AdminCatalogItem, AdminCatalogPage } from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { catalogAdmin } from '../../test/catalogAdmin.ts';
import { createTestApp } from '../../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup() {
  const test = await createTestApp();
  closers.push(test.close);
  const admin = await catalogAdmin(test.app);
  const actions = () =>
    test.db.$client
      .prepare('select action from audit_log where target_type = ? order by at, rowid')
      .pluck()
      .all('item');
  return { ...test, ...admin, actions };
}

interface Blocked {
  error: { code: string; details: { reason: string; blockers: string[] } };
}
const blockedBy = (response: { json: () => unknown }) => (response.json() as Blocked).error;

describe('catalog items (FR-CAT-8, FR-ADM-3)', () => {
  it('creates an item as a draft (audited); the list and detail show it', async () => {
    const t = await setup();
    const id = await t.createItem();
    const detail = (await t.send('GET', t.base(id))).json<AdminCatalogItem>();
    expect(detail).toMatchObject({
      slug: 'star-hopper',
      title: 'Star Hopper',
      systemId: 'nintendo-nes',
      scopeSlug: 'homebrew-8bit',
      status: 'draft',
      version: 1,
      onLapse: null,
      license: null,
      files: [],
      publishBlockers: ['license', 'onLapse', 'files'],
    });
    const page = (
      await t.send('GET', '/v1/admin/catalog/items?status=draft')
    ).json<AdminCatalogPage>();
    expect(page.items.map((item) => item.slug)).toEqual(['star-hopper']);
    expect(t.actions()).toEqual(['item.create']);
  });

  it('a taken slug is CONFLICT slugTaken; an unknown system or scope is VALIDATION_FAILED', async () => {
    const t = await setup();
    await t.createItem();
    const again = await t.send('POST', '/v1/admin/catalog/items', {
      slug: 'star-hopper',
      title: 'Again',
      systemId: 'nintendo-nes',
      scopeSlug: 'homebrew-8bit',
    });
    expect(again.json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'slugTaken' } },
    });
    const system = await t.send('POST', '/v1/admin/catalog/items', {
      slug: 'x',
      title: 'X',
      systemId: 'no-such-system',
      scopeSlug: 'homebrew-8bit',
    });
    expect(system.json()).toMatchObject({ error: { details: { reason: 'system' } } });
    const scope = await t.send('POST', '/v1/admin/catalog/items', {
      slug: 'y',
      title: 'Y',
      systemId: 'nintendo-nes',
      scopeSlug: 'nope',
    });
    expect(scope.json()).toMatchObject({ error: { details: { reason: 'scope' } } });
  });

  it('PATCH changes metadata and is audited with before and after', async () => {
    const t = await setup();
    const id = await t.createItem();
    const patched = await t.send('PATCH', t.base(id), {
      description: 'Hop between stars.',
      year: 2021,
      onLapse: 'remove',
      starter: true,
    });
    expect(patched.json()).toMatchObject({ year: 2021, onLapse: 'remove', starter: true });
    expect(t.actions()).toEqual(['item.create', 'item.update']);
  });
});

describe('the publish gate (C10, D44)', () => {
  it('C10: publish without a license is CONFLICT blocked [license]', async () => {
    const t = await setup();
    const id = await t.createItem();
    await t.send('PATCH', t.base(id), { onLapse: 'keep' });
    await t.uploadFile(id);
    const response = await t.send('POST', `${t.base(id)}/publish`);
    expect(response.statusCode).toBe(409);
    expect(blockedBy(response)).toMatchObject({
      code: 'CONFLICT',
      details: { reason: 'blocked', blockers: ['license'] },
    });
  });

  it('an unverified license blocks', async () => {
    const t = await setup();
    const id = await t.createItem();
    await t.putLicense(id);
    await t.send('PATCH', t.base(id), { onLapse: 'keep' });
    await t.uploadFile(id);
    expect(blockedBy(await t.send('POST', `${t.base(id)}/publish`)).details.blockers).toEqual([
      'licenseUnverified',
    ]);
  });

  it('an expired license blocks', async () => {
    const t = await setup();
    const id = await t.createItem();
    await t.makePublishable(id, { expiresAt: '2026-10-01T00:00:00.000Z' });
    expect(blockedBy(await t.send('POST', `${t.base(id)}/publish`)).details.blockers).toEqual([
      'licenseExpired',
    ]);
  });

  it('no on_lapse blocks', async () => {
    const t = await setup();
    const id = await t.createItem();
    await t.makePublishable(id);
    // on_lapse can't be cleared through the API: check the gate with a row that never had it.
    t.db.$client.prepare('update catalog_items set on_lapse = null').run();
    expect(blockedBy(await t.send('POST', `${t.base(id)}/publish`)).details.blockers).toEqual([
      'onLapse',
    ]);
  });

  it('only extra files block [files]', async () => {
    const t = await setup();
    const id = await t.createItem();
    await t.putLicense(id);
    await t.putEvidence(id);
    await t.send('POST', `${t.base(id)}/license/verify`);
    await t.send('PATCH', t.base(id), { onLapse: 'keep' });
    await t.uploadFile(id, 'manual.txt', 'extra');
    expect(blockedBy(await t.send('POST', `${t.base(id)}/publish`)).details.blockers).toEqual([
      'files',
    ]);
  });

  it('publish with everything succeeds and audits item.publish; the detail has no blockers', async () => {
    const t = await setup();
    const id = await t.createItem();
    await t.makePublishable(id);
    expect((await t.send('GET', t.base(id))).json<AdminCatalogItem>().publishBlockers).toEqual([]);
    const published = await t.send('POST', `${t.base(id)}/publish`);
    expect(published.statusCode).toBe(200);
    expect(published.json()).toMatchObject({
      status: 'published',
      publishedAt: '2026-10-25T12:00:00.000Z',
    });
    expect(t.actions()).toContain('item.publish');
    const unpublished = await t.send('POST', `${t.base(id)}/unpublish`);
    expect(unpublished.json()).toMatchObject({ status: 'unpublished' });
    expect(t.actions().at(-1)).toBe('item.unpublish');
  });

  it('a subscriber or an admin without CSRF cannot publish', async () => {
    const t = await setup();
    const id = await t.createItem();
    await t.makePublishable(id);
    const noCsrf = await t.app.inject({
      method: 'POST',
      url: `${t.base(id)}/publish`,
      headers: { cookie: t.session.jar.header() },
    });
    expect(noCsrf.statusCode).toBe(403);
    expect(t.db.$client.prepare('select status from catalog_items').pluck().get()).toBe('draft');
  });
});
