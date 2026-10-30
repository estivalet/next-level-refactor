import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { adminHeaders, adminSignIn } from '../../test/adminSignIn.ts';
import { seedItem } from '../../test/catalogSeed.ts';
import { signIn } from '../../test/launcherSignIn.ts';
import { createTestApp } from '../../test/testApp.ts';
import type { FileStore } from '../storage/FileStore.ts';
import { LocalDiskStore } from '../storage/LocalDiskStore.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

const ROM = Buffer.from('NEXTLEVEL TEST FIXTURE star hopper\n'.repeat(40));
const sha = (body: Buffer) => createHash('sha256').update(body).digest('hex');

async function setup(limits?: { upload?: number }, files?: (dir: string) => FileStore) {
  const test = await createTestApp({
    ...(limits ? { limits } : {}),
    ...(files ? { files } : {}),
  });
  closers.push(test.close);
  const admin = await adminSignIn(test.app, 'admin');
  const json = (method: 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) =>
    test.app.inject({
      method,
      url,
      headers: adminHeaders(admin, true),
      ...(payload ? { payload } : {}),
    });
  const raw = (url: string, body: Buffer, contentType = 'application/octet-stream') =>
    test.app.inject({
      method: 'PUT',
      url,
      headers: { ...adminHeaders(admin, true), 'content-type': contentType },
      payload: body,
    });
  /** Start → upload → complete; answers the complete response. */
  const upload = async (
    itemId: string,
    filename: string,
    body: Buffer,
    opts: { role?: string; sha256?: string } = {},
  ) => {
    const started = await json('POST', `/v1/admin/catalog/items/${itemId}/files`, {
      filename,
      role: opts.role ?? 'rom',
    });
    if (started.statusCode !== 200) return started;
    const { fileId, uploadUrl } = started.json<{ fileId: string; uploadUrl: string }>();
    const put = await raw(uploadUrl, body);
    if (put.statusCode !== 200) return put;
    return json('POST', `/v1/admin/catalog/items/${itemId}/files/${fileId}/complete`, {
      ...(opts.sha256 ? { sha256: opts.sha256 } : {}),
    });
  };
  const rows = (sql: string, ...args: unknown[]) => test.db.$client.prepare(sql).all(...args);
  const one = (sql: string, ...args: unknown[]) =>
    test.db.$client
      .prepare(sql)
      .pluck()
      .get(...args);
  const stored = async () =>
    (await readdir(test.filesDir, { recursive: true, withFileTypes: true }).catch(() => []))
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name));
  return { ...test, admin, json, raw, upload, rows, one, stored };
}

describe('catalog uploads (FR-ADM-3, US-F1, D41)', () => {
  it('US-F1: uploading a ROM computes and stores its SHA-256 and size', async () => {
    const t = await setup();
    seedItem(t.db);
    const done = await t.upload('item-1', 'Star Hopper (v1.1).nes', ROM);
    expect(done.statusCode).toBe(200);
    expect(done.json()).toMatchObject({
      filename: 'Star Hopper (v1.1).nes',
      size: ROM.length,
      sha256: sha(ROM),
      role: 'rom',
      status: 'ready',
    });
    expect(t.rows('select filename, size, sha256, status from catalog_files')).toEqual([
      { filename: 'Star Hopper (v1.1).nes', size: ROM.length, sha256: sha(ROM), status: 'ready' },
    ]);
    expect(await t.stored()).toHaveLength(1);
  });

  it("a filename that isn't safe or has another system's extension is VALIDATION_FAILED filename", async () => {
    const t = await setup();
    seedItem(t.db);
    for (const filename of ['..\\evil.nes', 'CON.nes', 'game.sfc']) {
      const started = await t.json('POST', '/v1/admin/catalog/items/item-1/files', {
        filename,
        role: 'rom',
      });
      expect(started.statusCode, filename).toBe(400);
      expect(started.json(), filename).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    }
    const manual = await t.json('POST', '/v1/admin/catalog/items/item-1/files', {
      filename: 'manual.pdf',
      role: 'extra',
    });
    expect(manual.statusCode).toBe(200);
    const wrong = await t.json('POST', '/v1/admin/catalog/items/item-1/files', {
      filename: 'game.sfc',
      role: 'rom',
    });
    expect(wrong.json()).toMatchObject({ error: { details: { reason: 'filename' } } });
  });

  it('start upload refuses a filename over 100 characters (MAX_PATH once installed)', async () => {
    const t = await setup();
    seedItem(t.db);
    const started = await t.json('POST', '/v1/admin/catalog/items/item-1/files', {
      filename: 'a'.repeat(97) + '.nes',
      role: 'rom',
    });
    expect(started.statusCode).toBe(400);
    expect(started.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('a second PUT to a file that already has its bytes is CONFLICT; the bytes stay', async () => {
    const t = await setup();
    seedItem(t.db);
    const started = await t.json('POST', '/v1/admin/catalog/items/item-1/files', {
      filename: 'hop.nes',
      role: 'rom',
    });
    const { fileId, uploadUrl } = started.json<{ fileId: string; uploadUrl: string }>();
    expect((await t.raw(uploadUrl, ROM)).statusCode).toBe(200);
    const again = await t.raw(uploadUrl, Buffer.from('other bytes'));
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: { code: 'CONFLICT' } });
    const done = await t.json('POST', `/v1/admin/catalog/items/item-1/files/${fileId}/complete`, {
      sha256: sha(ROM),
    });
    expect(done.statusCode).toBe(200);
    expect(await t.stored()).toHaveLength(1);
    const [path] = await t.stored();
    expect(await readFile(path ?? '')).toEqual(ROM);
  });

  it('a wrong client checksum is refused and the pending file is deleted', async () => {
    const t = await setup();
    seedItem(t.db);
    const done = await t.upload('item-1', 'hop.nes', ROM, { sha256: 'a'.repeat(64) });
    expect(done.statusCode).toBe(400);
    expect(done.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED', details: { reason: 'checksum' } },
    });
    expect(t.one('select count(*) from catalog_files')).toBe(0);
    expect(await t.stored()).toEqual([]);
  });

  it('replacing a file on a published item bumps version; the old file is gone', async () => {
    const t = await setup();
    seedItem(t.db, { status: 'published' });
    await t.upload('item-1', 'hop.nes', ROM);
    expect(t.one('select version from catalog_items')).toBe(2);
    const second = Buffer.from('a newer build');
    await t.upload('item-1', 'hop.nes', second, { sha256: sha(second) });
    expect(t.one('select version from catalog_items')).toBe(3);
    expect(t.rows("select sha256 from catalog_files where status = 'ready'")).toEqual([
      { sha256: sha(second) },
    ]);
    expect(await t.stored()).toHaveLength(1);
  });

  it("C10: an extra replacing a published item's last ROM is CONFLICT lastFile; the ROM stays", async () => {
    const t = await setup();
    seedItem(t.db, { status: 'published' });
    await t.upload('item-1', 'hop.nes', ROM);
    const swap = await t.upload('item-1', 'HOP.nes', Buffer.from('notes'), { role: 'extra' });
    expect(swap.json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'lastFile' } },
    });
    expect(t.rows('select role, status from catalog_files')).toEqual([
      { role: 'rom', status: 'ready' },
    ]);
    expect(await t.stored()).toHaveLength(1);
  });

  it('a draft item keeps version 1 while files change', async () => {
    const t = await setup();
    seedItem(t.db);
    await t.upload('item-1', 'hop.nes', ROM);
    expect(t.one('select version from catalog_items')).toBe(1);
  });

  it("the last ROM of a published item can't be removed; another can", async () => {
    const t = await setup();
    seedItem(t.db, { status: 'published' });
    const a = (await t.upload('item-1', 'a.nes', ROM)).json<{ id: string }>();
    const b = (await t.upload('item-1', 'b.nes', ROM)).json<{ id: string }>();
    expect(
      (await t.json('DELETE', `/v1/admin/catalog/items/item-1/files/${a.id}`)).statusCode,
    ).toBe(204);
    const last = await t.json('DELETE', `/v1/admin/catalog/items/item-1/files/${b.id}`);
    expect(last.json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'lastFile' } },
    });
    expect(t.one('select version from catalog_items')).toBe(4);
  });

  it('an upload larger than the limit is refused with no file left', async () => {
    const t = await setup({ upload: 100 });
    seedItem(t.db);
    const done = await t.upload('item-1', 'big.nes', Buffer.alloc(101, 1));
    expect(done.statusCode).toBe(400);
    expect(done.json()).toMatchObject({ error: { details: { reason: 'tooLarge' } } });
    expect(await t.stored()).toEqual([]);
    expect(t.one("select count(*) from catalog_files where status = 'ready'")).toBe(0);
  });

  it('a non-admin or a missing CSRF token is refused', async () => {
    const t = await setup();
    seedItem(t.db);
    const noCsrf = await t.app.inject({
      method: 'POST',
      url: '/v1/admin/catalog/items/item-1/files',
      headers: adminHeaders(t.admin),
      payload: { filename: 'a.nes', role: 'rom' },
    });
    expect(noCsrf.statusCode).toBe(403);
    const player = await signIn(t.app, 'subscriber');
    const asPlayer = await t.app.inject({
      method: 'POST',
      url: '/v1/admin/catalog/items/item-1/files',
      headers: { authorization: `Bearer ${player.accessToken}` },
      payload: { filename: 'a.nes', role: 'rom' },
    });
    expect([401, 403]).toContain(asPlayer.statusCode);
    expect(t.one('select count(*) from catalog_files')).toBe(0);
  });

  it('every mutation writes one audit row: file add/remove, media set/remove', async () => {
    const t = await setup();
    seedItem(t.db);
    const file = (await t.upload('item-1', 'hop.nes', ROM)).json<{ id: string }>();
    await t.json('DELETE', `/v1/admin/catalog/items/item-1/files/${file.id}`);
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const art = await t.raw('/v1/admin/catalog/items/item-1/media/box-front', png, 'image/png');
    expect(art.statusCode).toBe(200);
    expect(
      (await t.json('DELETE', '/v1/admin/catalog/items/item-1/media/box-front')).statusCode,
    ).toBe(204);
    expect(
      t.rows(
        'select action, target_type as type, target_id as target from audit_log order by at, rowid',
      ),
    ).toEqual([
      { action: 'item.file.add', type: 'item', target: 'item-1' },
      { action: 'item.file.remove', type: 'item', target: 'item-1' },
      { action: 'item.media.set', type: 'item', target: 'item-1' },
      { action: 'item.media.remove', type: 'item', target: 'item-1' },
    ]);
  });

  it('media takes an art kind and an image or video type', async () => {
    const t = await setup();
    seedItem(t.db);
    const exe = await t.raw(
      '/v1/admin/catalog/items/item-1/media/box-front',
      ROM,
      'application/x-msdownload',
    );
    expect(exe.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    const kind = await t.raw('/v1/admin/catalog/items/item-1/media/wallpaper', ROM, 'image/png');
    expect(kind.statusCode).toBe(400);
    expect(await t.stored()).toEqual([]);
  });

  it('an unknown item is NOT_FOUND', async () => {
    const t = await setup();
    const started = await t.json('POST', '/v1/admin/catalog/items/nope/files', {
      filename: 'a.nes',
      role: 'rom',
    });
    expect(started.statusCode).toBe(404);
  });
  it('a file changed while unpublished bumps version once the item was ever published', async () => {
    const t = await setup();
    seedItem(t.db, { status: 'unpublished' });
    t.db.$client
      .prepare("update catalog_items set published_at = '2026-10-01T00:00:00.000Z'")
      .run();
    await t.upload('item-1', 'hop.nes', ROM);
    expect(t.one('select version from catalog_items')).toBe(2);
  });

  it('a storage delete that fails after the change still answers success (the bytes are left)', async () => {
    let failDeletes = false;
    const t = await setup(undefined, (dir) => {
      const store = new LocalDiskStore(dir);
      const remove = store.delete.bind(store);
      store.delete = (key) =>
        failDeletes
          ? Promise.reject(Object.assign(new Error('busy'), { code: 'EBUSY' }))
          : remove(key);
      return store;
    });
    seedItem(t.db);
    const file = (await t.upload('item-1', 'hop.nes', ROM)).json<{ id: string }>();
    failDeletes = true;
    const removed = await t.json('DELETE', `/v1/admin/catalog/items/item-1/files/${file.id}`);
    expect(removed.statusCode).toBe(204);
    expect(t.one('select count(*) from catalog_files')).toBe(0);
  });

  it('the raw upload routes refuse a player and a missing CSRF token, storing nothing', async () => {
    const t = await setup();
    seedItem(t.db);
    await t.json('PUT', '/v1/admin/catalog/items/item-1/license', {
      type: 'freeware',
      rightsHolder: 'Pals',
      contact: 'p@example.test',
      terms: 'ok',
    });
    const started = await t.json('POST', '/v1/admin/catalog/items/item-1/files', {
      filename: 'a.nes',
      role: 'rom',
    });
    const { uploadUrl } = started.json<{ uploadUrl: string }>();
    const player = await signIn(t.app, 'subscriber');
    const urls: Array<[string, string]> = [
      [uploadUrl, 'application/octet-stream'],
      ['/v1/admin/catalog/items/item-1/media/box-front', 'image/png'],
      ['/v1/admin/catalog/items/item-1/license/evidence?filename=p.txt', 'text/plain'],
    ];
    for (const [url, type] of urls) {
      const noCsrf = await t.app.inject({
        method: 'PUT',
        url,
        headers: { ...adminHeaders(t.admin), 'content-type': type },
        payload: ROM,
      });
      expect(noCsrf.statusCode, url).toBe(403);
      const asPlayer = await t.app.inject({
        method: 'PUT',
        url,
        headers: { authorization: `Bearer ${player.accessToken}`, 'content-type': type },
        payload: ROM,
      });
      expect([401, 403], url).toContain(asPlayer.statusCode);
    }
    expect(await t.stored()).toEqual([]);
  });
});
