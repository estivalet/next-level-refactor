import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { catalogAdmin } from '../../test/catalogAdmin.ts';
import { createTestApp } from '../../test/testApp.ts';
import { createContext } from '../context.ts';
import { testEnv } from '../../test/testApp.ts';
import { seedItem } from '../../test/catalogSeed.ts';
import { auditPage } from '../admin/audit.ts';
import { runMaintenance } from './maintenance.ts';

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
});
