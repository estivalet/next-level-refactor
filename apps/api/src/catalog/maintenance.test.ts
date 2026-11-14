import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { catalogAdmin } from '../../test/catalogAdmin.ts';
import { createTestApp } from '../../test/testApp.ts';
import { createContext } from '../context.ts';
import { testEnv } from '../../test/testApp.ts';
import { seedItem } from '../../test/catalogSeed.ts';
import { auditPage } from '../admin/audit.ts';
import { maintenanceFailure, runMaintenance } from './maintenance.ts';
import { LocalDiskStore } from '../storage/LocalDiskStore.ts';
import { utimes } from 'node:fs/promises';
import { join } from 'node:path';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup() {
  const test = await createTestApp();
  closers.push(test.close);
  const admin = await catalogAdmin(test.app);
  const ctx = createContext({
    env: testEnv({ FILES_DIR: test.filesDir }),
    db: test.db,
    clock: test.clock.read,
    billing: null,
  });
  return { ...test, ...admin, ctx };
}

describe('the maintenance job (D44, security §5)', () => {
  it('unpublishes an item whose license expired, audited with a null actor', async () => {
    const t = await setup();
    const id = await t.createItem();
    await t.makePublishable(id, { expiresAt: '2026-10-26T00:00:00.000Z' });
    await t.send('POST', `${t.base(id)}/publish`);
    expect(await runMaintenance(t.ctx)).toMatchObject({ expired: 0 });
    t.clock.advance(2 * 24 * 3600 * 1000);
    expect(await runMaintenance(t.ctx)).toMatchObject({ expired: 1 });
    expect(t.db.$client.prepare('select status from catalog_items').pluck().get()).toBe(
      'unpublished',
    );
    const entry = t.db.$client
      .prepare("select actor_id as actor, after from audit_log where action = 'item.unpublish'")
      .get() as { actor: string | null; after: string };
    expect(entry.actor).toBeNull();
    expect(JSON.parse(entry.after)).toMatchObject({
      status: 'unpublished',
      reason: 'licenseExpired',
    });
    // The console lists it with no actor (its session has expired by now: read the page directly).
    expect(auditPage(t.ctx, { limit: 5 }).items[0]).toMatchObject({
      actor: null,
      action: 'item.unpublish',
    });
    expect(await runMaintenance(t.ctx)).toMatchObject({ expired: 0 });
  });

  it('prunes downloads older than 12 months and pending uploads older than 24 h', async () => {
    const t = await setup();
    const id = await t.createItem();
    const insert = t.db.$client.prepare(
      `insert into downloads (id, user_id, device_id, file_id, issued_at, ip_hash)
       values (?, 'u', 'd', 'f', ?, 'h')`,
    );
    insert.run('old', '2025-10-24T12:00:00.000Z');
    insert.run('recent', '2025-12-01T12:00:00.000Z');
    const started = await t.send('POST', `${t.base(id)}/files`, { filename: 'a.nes', role: 'rom' });
    const { fileId } = started.json<{ fileId: string }>();
    await t.ctx.files.put(`files/${id}/${fileId}`, Readable.from(['partial']), 100);
    t.clock.advance(25 * 3600 * 1000);
    const result = await runMaintenance(t.ctx);
    expect(result).toMatchObject({ downloadsPruned: 1, uploadsPruned: 1 });
    expect(t.db.$client.prepare('select id from downloads').pluck().all()).toEqual(['recent']);
    expect(t.db.$client.prepare('select count(*) from catalog_files').pluck().get()).toBe(0);
    expect(await t.ctx.files.size(`files/${id}/${fileId}`)).toBeNull();
  });

  it('a fresh pending upload stays', async () => {
    const t = await setup();
    const id = await t.createItem();
    await t.send('POST', `${t.base(id)}/files`, { filename: 'a.nes', role: 'rom' });
    expect(await runMaintenance(t.ctx)).toMatchObject({ uploadsPruned: 0 });
    expect(t.db.$client.prepare('select count(*) from catalog_files').pluck().get()).toBe(1);
  });

  it('runs when the API starts: an item whose license expired meanwhile is unpublished', async () => {
    const test = await createTestApp();
    closers.push(test.close);
    seedItem(test.db, { status: 'published' });
    test.db.$client
      .prepare(
        `insert into licenses (id, type, rights_holder, contact, terms, expires_at, verified_at,
           created_at) values ('l1', 'freeware', 'Pals', 'p@example.test', 't', ?, ?, ?)`,
      )
      .run('2026-10-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
    test.db.$client.prepare("update catalog_items set license_id = 'l1'").run();
    await test.app.ready();
    expect(test.db.$client.prepare('select status from catalog_items').pluck().get()).toBe(
      'unpublished',
    );
  });

  it('orphan sweep deletes keys with no row older than 24 h, keeps newer ones', async () => {
    const t = await setup();
    const id = await t.createItem();
    await t.makePublishable(id);
    const referenced = t.db.$client
      .prepare('select storage_key from catalog_files')
      .pluck()
      .get() as string;
    await t.ctx.files.put('files/gone/old', Readable.from(['x']), 1024);
    await t.ctx.files.put('media/gone/box-front/1', Readable.from(['x']), 1024);
    await t.ctx.files.put('files/gone/new', Readable.from(['x']), 1024);
    const old = new Date(t.clock.read().getTime() - 2 * 24 * 3600 * 1000);
    const recent = new Date(t.clock.read().getTime() - 3600 * 1000);
    const at = (key: string) => join(t.filesDir, ...key.split('/'));
    for (const key of ['files/gone/old', 'media/gone/box-front/1', referenced]) {
      await utimes(at(key), old, old);
    }
    await utimes(at('files/gone/new'), recent, recent);
    expect(await runMaintenance(t.ctx)).toMatchObject({ orphansDeleted: 2 });
    expect(await t.ctx.files.size('files/gone/old')).toBeNull();
    expect(await t.ctx.files.size('media/gone/box-front/1')).toBeNull();
    expect(await t.ctx.files.size('files/gone/new')).toBe(1);
    expect(await t.ctx.files.size(referenced)).not.toBeNull();
  });

  it('maintenance failure log includes error.code', () => {
    const error = Object.assign(new Error('S3 LIST failed with 503'), { code: 'S3_ERROR' });
    expect(maintenanceFailure(error)).toEqual({ err: 'Error', code: 'S3_ERROR' });
    expect(maintenanceFailure('boom')).toEqual({ err: 'unknown', code: null });
  });

  it('the sweep deletes nothing when the database names no files (a new or restored database)', async () => {
    const t = await setup();
    await t.ctx.files.put('files/i1/f1', Readable.from(['x']), 1024);
    const old = new Date(t.clock.read().getTime() - 2 * 24 * 3600 * 1000);
    await utimes(join(t.filesDir, 'files', 'i1', 'f1'), old, old);
    expect(await runMaintenance(t.ctx)).toMatchObject({
      orphansDeleted: 0,
      orphanSweep: 'skipped',
    });
    expect(await t.ctx.files.size('files/i1/f1')).toBe(1);
  });

  it('a sweep that would delete more than a tenth of the store (and over 25 files) deletes nothing', async () => {
    const t = await setup();
    const id = await t.createItem();
    await t.makePublishable(id);
    const old = new Date(t.clock.read().getTime() - 2 * 24 * 3600 * 1000);
    for (let i = 0; i < 30; i += 1) {
      await t.ctx.files.put(`files/gone/f${String(i)}`, Readable.from(['x']), 1024);
      await utimes(join(t.filesDir, 'files', 'gone', `f${String(i)}`), old, old);
    }
    expect(await runMaintenance(t.ctx)).toMatchObject({
      orphansDeleted: 0,
      orphanSweep: 'skipped',
    });
    expect(await t.ctx.files.size('files/gone/f0')).toBe(1);
  });

  it('the run at start never sweeps', async () => {
    const t = await setup();
    expect(await runMaintenance(t.ctx, { sweep: false })).toMatchObject({ orphanSweep: 'off' });
  });

  it('a store that never answers keeps neither the API from starting nor runs piling up', async () => {
    let lists = 0;
    const test = await createTestApp({
      files: (dir) => {
        const store = new LocalDiskStore(dir);
        return Object.assign(Object.create(store) as LocalDiskStore, {
          // eslint-disable-next-line require-yield -- a listing that never answers (a stalled S3)
          list: async function* () {
            lists += 1;
            await new Promise(() => undefined);
          },
        });
      },
    });
    closers.push(test.close);
    const health = await test.app.inject({ method: 'GET', url: '/v1/health' });
    expect(health.statusCode).toBe(200);
    expect(lists).toBe(0);
  });
});
