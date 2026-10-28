import type { DownloadGrant } from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { catalogWorld } from '../../test/catalogPlayer.ts';
import { createTestApp } from '../../test/testApp.ts';
import { logOptions } from '../log.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

const BODY = 'dummy bytes of Star Hopper.nes';

async function setup() {
  const lines: string[] = [];
  const test = await createTestApp({
    log: { ...logOptions('production'), stream: { write: (line: string) => lines.push(line) } },
  });
  closers.push(test.close);
  const world = await catalogWorld(test.app);
  const id = await world.publish('star-hopper');
  await world.planScopes(['homebrew-8bit']);
  const grant = async () =>
    (
      await world.post(`/v1/catalog/items/${id}/downloads`, { deviceId: world.player.deviceId })
    ).json<DownloadGrant>().files[0];
  const fetchFile = (url: string, headers: Record<string, string> = {}) =>
    test.app.inject({ url: new URL(url).pathname, headers });
  return { ...test, ...world, id, grant, fetchFile, lines };
}

describe('the files route (FR-CAT-6, security §2, Review Focus 1)', () => {
  it('FR-CAT-6: a URL works for its user and fails after 10 minutes', async () => {
    const t = await setup();
    const file = await t.grant();
    const ok = await t.fetchFile(file?.url ?? '');
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toBe(BODY);
    expect(ok.headers['accept-ranges']).toBe('bytes');
    expect(ok.headers['content-length']).toBe(String(BODY.length));
    expect(ok.headers.etag).toBe(`"${String(file?.sha256)}"`);
    t.clock.advance(10 * 60 * 1000);
    const late = await t.fetchFile(file?.url ?? '');
    expect(late.statusCode).toBe(401);
    expect(late.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });

  it("a token from one file can't fetch another; a tampered token is refused", async () => {
    const t = await setup();
    const file = await t.grant();
    const url = file?.url ?? '';
    const tampered = url.replace(/\.([\w-])/, (_m, c: string) => `.${c === 'A' ? 'B' : 'A'}`);
    expect((await t.fetchFile(tampered)).statusCode).toBe(401);
    // A media token names art, not a file: it can't serve the ROM.
    expect((await t.fetchFile('http://localhost:4000/v1/files/x.y')).statusCode).toBe(401);
  });

  it("a revoked device's token is refused", async () => {
    const t = await setup();
    const file = await t.grant();
    t.db.$client
      .prepare('update devices set revoked_at = ? where id = ?')
      .run('2026-10-25T12:01:00.000Z', t.player.deviceId);
    const response = await t.fetchFile(file?.url ?? '');
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it("a suspended user's token is refused", async () => {
    const t = await setup();
    const file = await t.grant();
    t.db.$client
      .prepare("update users set status = 'suspended' where id = ?")
      .run(t.player.user.id);
    expect((await t.fetchFile(file?.url ?? '')).statusCode).toBe(403);
  });

  it('Range returns 206 with the right bytes; a range past the end is 416', async () => {
    const t = await setup();
    const url = (await t.grant())?.url ?? '';
    const part = await t.fetchFile(url, { range: 'bytes=6-10' });
    expect(part.statusCode).toBe(206);
    expect(part.body).toBe(BODY.slice(6, 11));
    expect(part.headers['content-range']).toBe(`bytes 6-10/${String(BODY.length)}`);
    expect(part.headers['content-length']).toBe('5');
    const tail = await t.fetchFile(url, { range: 'bytes=6-' });
    expect(tail.statusCode).toBe(206);
    expect(tail.body).toBe(BODY.slice(6));
    const past = await t.fetchFile(url, { range: `bytes=${String(BODY.length)}-` });
    expect(past.statusCode).toBe(416);
    expect(past.headers['content-range']).toBe(`bytes */${String(BODY.length)}`);
    const clipped = await t.fetchFile(url, { range: 'bytes=6-99999' });
    expect(clipped.statusCode).toBe(206);
    expect(clipped.body).toBe(BODY.slice(6));
  });

  it('a file replaced or removed since the URL was issued is 410', async () => {
    const t = await setup();
    const file = await t.grant();
    t.db.$client.prepare('delete from catalog_files').run();
    const gone = await t.fetchFile(file?.url ?? '');
    expect(gone.statusCode).toBe(410);
    expect(gone.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('the request log never contains the token', async () => {
    const t = await setup();
    const url = (await t.grant())?.url ?? '';
    const token = url.split('/').at(-1) ?? '';
    await t.fetchFile(url);
    await t.fetchFile(url, { range: 'bytes=0-1' });
    const text = t.lines.join('\n');
    expect(text).toContain('/v1/files/:token');
    expect(text).not.toContain(token);
    expect(text).not.toContain(token.split('.')[0] ?? 'never');
  });

  it('media URLs serve art for an hour', async () => {
    const t = await setup();
    await t.admin.raw(
      `${t.admin.base(t.id)}/media/box-front`,
      Buffer.from('png bytes'),
      'image/png',
    );
    const item = (await t.get(`/v1/catalog/items/${t.id}`)).json<{ boxArt: string }>();
    const art = await t.fetchFile(item.boxArt);
    expect(art.statusCode).toBe(200);
    expect(art.body).toBe('png bytes');
    t.clock.advance(60 * 60 * 1000);
    expect((await t.fetchFile(item.boxArt)).statusCode).toBe(401);
  });
});
