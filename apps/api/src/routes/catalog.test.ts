import type { CatalogItem, CatalogPage } from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { catalogWorld } from '../../test/catalogPlayer.ts';
import { bearer, signIn } from '../../test/launcherSignIn.ts';
import { createTestApp } from '../../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup(rawEnv: Record<string, string> = {}) {
  const test = await createTestApp({ rawEnv });
  closers.push(test.close);
  const world = await catalogWorld(test.app);
  return { ...test, ...world };
}

const slugs = (page: { json: () => unknown }) =>
  (page.json() as CatalogPage).items.map((item) => item.slug);

describe('subscriber catalog (FR-CAT-1, FR-CAT-2, C8, US-E1)', () => {
  it('C8 / US-E1: a plan with homebrew-8bit sees those items and not other scopes', async () => {
    const t = await setup();
    await t.publish('star-hopper');
    await t.publish('orbit-drift', { scopeSlug: 'homebrew-16bit' });
    await t.planScopes(['homebrew-8bit']);
    const page = await t.get('/v1/catalog/items');
    expect(page.statusCode).toBe(200);
    expect(slugs(page)).toEqual(['star-hopper']);
    expect(page.json<CatalogPage>().items[0]).toMatchObject({
      title: 'Star Hopper',
      systemId: 'nintendo-nes',
      scope: 'homebrew-8bit',
      license: { type: 'author-permission', rightsHolder: 'Pixel Pals' },
      version: 1,
      starter: false,
    });
  });

  it('an out-of-scope or draft item by id is NOT_FOUND', async () => {
    const t = await setup();
    const other = await t.publish('orbit-drift', { scopeSlug: 'homebrew-16bit' });
    const draft = await t.admin.createItem('draft-one');
    await t.planScopes(['homebrew-8bit']);
    for (const id of [other, draft, 'no-such-id']) {
      const response = await t.get(`/v1/catalog/items/${id}`);
      expect(response.statusCode, id).toBe(404);
      expect(response.json(), id).toMatchObject({ error: { code: 'NOT_FOUND' } });
    }
  });

  it('the detail has files with size and sha256, media URLs and the license terms', async () => {
    const t = await setup();
    const id = await t.publish('star-hopper');
    await t.admin.raw(`${t.admin.base(id)}/media/box-front`, Buffer.from('png'), 'image/png');
    await t.planScopes(['homebrew-8bit']);
    const item = (await t.get(`/v1/catalog/items/${id}`)).json<CatalogItem>();
    expect(item.files).toEqual([
      expect.objectContaining({
        filename: 'Star Hopper.nes',
        role: 'rom',
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/) as unknown,
      }),
    ]);
    expect(item.license.terms).toContain('NextLevel');
    expect(item.media).toEqual([
      {
        kind: 'box-front',
        url: expect.stringMatching(/^http:\/\/localhost:4000\/v1\/files\//) as unknown,
      },
    ]);
    expect(item.boxArt).toBe(item.media[0]?.url);
  });

  it('status none is SUBSCRIPTION_REQUIRED, suspended SUSPENDED', async () => {
    const t = await setup({ BILLING_ENABLED: 'true', BILLING_STUB: '1' });
    const none = await t.get('/v1/catalog/items');
    expect(none.json()).toMatchObject({ error: { code: 'SUBSCRIPTION_REQUIRED' } });
    t.db.$client
      .prepare("update users set status = 'suspended' where email = ?")
      .run('subscriber@nextlevel.test');
    const suspended = await t.get('/v1/catalog/items');
    expect(suspended.json()).toMatchObject({ error: { code: 'SUSPENDED' } });
  });

  it('an admin sees every published item, no drafts', async () => {
    const t = await setup();
    await t.publish('star-hopper');
    await t.publish('orbit-drift', { scopeSlug: 'homebrew-16bit' });
    await t.admin.createItem('draft-one');
    const admin = await signIn(t.app, 'admin', 'Admin PC');
    const page = await t.app.inject({
      url: '/v1/catalog/items',
      headers: bearer(admin.accessToken),
    });
    expect(slugs(page)).toEqual(['orbit-drift', 'star-hopper']); // title order
  });

  it('US-F4: removing a scope from the plan hides its items on the next request', async () => {
    const t = await setup();
    await t.publish('star-hopper');
    await t.planScopes(['homebrew-8bit']);
    expect(slugs(await t.get('/v1/catalog/items'))).toEqual(['star-hopper']);
    await t.planScopes([]);
    expect(slugs(await t.get('/v1/catalog/items'))).toEqual([]);
  });

  it('US-F1: a newly published item shows on the next request', async () => {
    const t = await setup();
    await t.admin.send('POST', '/v1/admin/scopes', {
      slug: 'homebrew-8bit',
      name: 'Homebrew 8-bit',
      description: '',
    });
    await t.planScopes(['homebrew-8bit']);
    expect(slugs(await t.get('/v1/catalog/items'))).toEqual([]);
    await t.publish('star-hopper');
    expect(slugs(await t.get('/v1/catalog/items'))).toEqual(['star-hopper']);
  });

  it('an item whose license expired is gone before the maintenance job runs', async () => {
    const t = await setup();
    await t.publish('star-hopper');
    await t.planScopes(['homebrew-8bit']);
    t.db.$client.prepare("update licenses set expires_at = '2026-10-25T11:00:00.000Z'").run();
    expect(slugs(await t.get('/v1/catalog/items'))).toEqual([]);
  });

  it('starter=true lists only starter items; system, genre and q filter', async () => {
    const t = await setup();
    await t.publish('star-hopper', {
      patch: { starter: true, genre: 'Shooter', developer: 'Pixel Pals' },
    });
    await t.publish('moss-garden', {
      systemId: 'nintendo-game-boy',
      filename: 'Moss Garden.gb',
      patch: { genre: 'Puzzle' },
    });
    await t.planScopes(['homebrew-8bit']);
    expect(slugs(await t.get('/v1/catalog/items?starter=true'))).toEqual(['star-hopper']);
    expect(slugs(await t.get('/v1/catalog/items?system=nintendo-game-boy'))).toEqual([
      'moss-garden',
    ]);
    expect(slugs(await t.get('/v1/catalog/items?genre=puzzle'))).toEqual(['moss-garden']);
    expect(slugs(await t.get('/v1/catalog/items?q=STAR'))).toEqual(['star-hopper']);
    expect(slugs(await t.get('/v1/catalog/items?q=pixel%20pals'))).toEqual(['star-hopper']);
    expect(slugs(await t.get('/v1/catalog/items?scope=homebrew-16bit'))).toEqual([]);
  });

  it('pages in title order with a cursor; pages never repeat', async () => {
    const t = await setup();
    for (const slug of ['c-game', 'a-game', 'b-game', 'd-game']) await t.publish(slug);
    await t.planScopes(['homebrew-8bit']);
    const seen: string[] = [];
    let url = '/v1/catalog/items?limit=3';
    for (;;) {
      const page = (await t.get(url)).json<CatalogPage>();
      seen.push(...page.items.map((item) => item.slug));
      if (!page.nextCursor) break;
      url = `/v1/catalog/items?limit=3&cursor=${encodeURIComponent(page.nextCursor)}`;
    }
    expect(seen).toEqual(['a-game', 'b-game', 'c-game', 'd-game']);
    expect(new Set(seen).size).toBe(4);
  });
  it('a page reads only the rows it needs (limit + 1), not the whole catalog', async () => {
    const t = await setup();
    for (const slug of ['a-game', 'b-game', 'c-game']) await t.publish(slug);
    await t.planScopes(['homebrew-8bit']);
    const statements: string[] = [];
    const prepare = t.db.$client.prepare.bind(t.db.$client);
    t.db.$client.prepare = (sql: string) => {
      statements.push(sql);
      return prepare(sql);
    };
    await t.get('/v1/catalog/items?limit=1');
    t.db.$client.prepare = prepare;
    const page = statements.find(
      (sql) => sql.includes('from "catalog_items"') && sql.includes('order by'),
    );
    expect(page).toMatch(/limit \?/);
  });
});
