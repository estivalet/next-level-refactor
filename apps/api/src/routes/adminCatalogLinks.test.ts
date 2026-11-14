import type { AdminCatalogItem } from '@nextlevel/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogAdmin } from '../../test/catalogAdmin.ts';
import { createTestApp } from '../../test/testApp.ts';

// FR-CAT-9, D65: adding catalog files as Drive / archive.org links through the admin routes.

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

const LINK = 'https://archive.org/details/nl-demo/Star%20Hopper.nes';
const DIRECT = 'https://archive.org/download/nl-demo/Star%20Hopper.nes';
const BYTES = Buffer.from('NEXTLEVEL TEST FIXTURE star hopper\n'.repeat(10));

async function setup() {
  const linkFetch: typeof fetch = (input) =>
    String(input instanceof Request ? input.url : input) === DIRECT
      ? Promise.resolve(new Response(BYTES))
      : Promise.reject(new TypeError('fetch failed'));
  const test = await createTestApp({ linkFetch });
  closers.push(test.close);
  const admin = await catalogAdmin(test.app);
  const id = await admin.createItem();
  const item = async () => (await admin.send('GET', admin.base(id))).json<AdminCatalogItem>();
  return { ...test, ...admin, id, item };
}

describe('admin link routes (FR-CAT-9)', () => {
  it('FR-CAT-9: POST links adds a checking link that becomes ready; a bad link is VALIDATION_FAILED linkHost', async () => {
    const t = await setup();
    const added = await t.send('POST', `${t.base(t.id)}/links`, {
      filename: 'Star Hopper.nes',
      role: 'rom',
      link: LINK,
    });
    expect(added.statusCode).toBe(200);
    expect(added.json()).toMatchObject({
      status: 'pending',
      link: { host: 'archive', url: DIRECT, state: 'checking', error: null },
    });
    await vi.waitFor(async () => {
      expect((await t.item()).files[0]).toMatchObject({ status: 'ready', size: BYTES.length });
    });
    const bad = await t.send('POST', `${t.base(t.id)}/links`, {
      filename: 'Other.nes',
      role: 'rom',
      link: 'https://example.com/other.nes',
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED', details: { reason: 'linkHost' } },
    });
  });

  it('FR-CAT-9: an admin request without CSRF cannot add a link', async () => {
    const t = await setup();
    const noCsrf = await t.app.inject({
      method: 'POST',
      url: `${t.base(t.id)}/links`,
      headers: { cookie: t.session.jar.header() },
      payload: { filename: 'Star Hopper.nes', role: 'rom', link: LINK },
    });
    expect(noCsrf.statusCode).toBe(403);
    expect((await t.item()).files).toEqual([]);
  });

  it('FR-CAT-9: POST check on a linked file starts a check; on an uploaded file it is NOT_FOUND', async () => {
    const t = await setup();
    const added = (
      await t.send('POST', `${t.base(t.id)}/links`, {
        filename: 'Star Hopper.nes',
        role: 'rom',
        link: LINK,
      })
    ).json<{ id: string }>();
    await vi.waitFor(async () => {
      expect((await t.item()).files[0]?.status).toBe('ready');
    });
    const again = await t.send('POST', `${t.base(t.id)}/files/${added.id}/check`);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ link: { state: 'checking' } });
    const uploaded = (await t.uploadFile(t.id, 'Other.nes')).json<{ id: string }>();
    const notLinked = await t.send('POST', `${t.base(t.id)}/files/${uploaded.id}/check`);
    expect(notLinked.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
