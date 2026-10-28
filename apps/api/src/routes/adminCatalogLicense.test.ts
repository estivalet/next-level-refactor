import type { AdminCatalogItem } from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { catalogAdmin, LICENSE } from '../../test/catalogAdmin.ts';
import { signIn } from '../../test/launcherSignIn.ts';
import { createTestApp } from '../../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup() {
  const test = await createTestApp();
  closers.push(test.close);
  const admin = await catalogAdmin(test.app);
  const id = await admin.createItem();
  const detail = async () => (await admin.send('GET', admin.base(id))).json<AdminCatalogItem>();
  const audit = () =>
    test.db.$client
      .prepare(
        "select action, actor_id as actor from audit_log where target_type = 'item' order by at, rowid",
      )
      .all() as Array<{ action: string; actor: string | null }>;
  return { ...test, ...admin, id, detail, audit };
}

describe('license records (content policy §4, D44)', () => {
  it('PUT license stores the record unverified (audited item.license)', async () => {
    const t = await setup();
    const response = await t.putLicense(t.id, { territories: ['BR', 'PT'] });
    expect(response.statusCode).toBe(200);
    expect((await t.detail()).license).toMatchObject({
      ...LICENSE,
      territories: ['BR', 'PT'],
      evidenceFilename: null,
      verifiedBy: null,
      verifiedAt: null,
    });
    expect(t.audit().map((a) => a.action)).toContain('item.license');
  });

  it('verify needs evidence; with it, records who and when', async () => {
    const t = await setup();
    await t.putLicense(t.id);
    const early = await t.send('POST', `${t.base(t.id)}/license/verify`);
    expect(early.json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'noEvidence' } },
    });
    const evidence = await t.putEvidence(t.id);
    expect(evidence.statusCode).toBe(200);
    expect((await t.detail()).license?.evidenceFilename).toBe('permission.txt');
    const verified = await t.send('POST', `${t.base(t.id)}/license/verify`);
    expect(verified.statusCode).toBe(200);
    expect((await t.detail()).license).toMatchObject({
      verifiedBy: { email: 'admin@nextlevel.test' },
      verifiedAt: '2026-10-25T12:00:00.000Z',
    });
    expect(t.audit().map((a) => a.action)).toContain('item.license.verify');
  });

  it('evidence must be a pdf, image, text or email file within 20 MiB', async () => {
    const t = await setup();
    await t.putLicense(t.id);
    const exe = await t.raw(
      `${t.base(t.id)}/license/evidence?filename=a.exe`,
      Buffer.from('MZ'),
      'application/x-msdownload',
    );
    expect(exe.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('replacing the license of a published item unpublishes it in one transaction (both audited)', async () => {
    const t = await setup();
    await t.makePublishable(t.id);
    await t.send('POST', `${t.base(t.id)}/publish`);
    const replaced = await t.putLicense(t.id, { rightsHolder: 'Pixel Pals Ltd' });
    expect(replaced.statusCode).toBe(200);
    const detail = await t.detail();
    expect(detail.status).toBe('unpublished');
    expect(detail.license).toMatchObject({ rightsHolder: 'Pixel Pals Ltd', verifiedAt: null });
    expect(
      t
        .audit()
        .slice(-2)
        .map((a) => a.action)
        .sort(),
    ).toEqual(['item.license', 'item.unpublish']);
  });

  it('evidence downloads are admin-only and come as an attachment', async () => {
    const t = await setup();
    await t.putLicense(t.id);
    await t.putEvidence(t.id, Buffer.from('Signed permission email'));
    const file = await t.send('GET', `${t.base(t.id)}/license/evidence`);
    expect(file.statusCode).toBe(200);
    expect(file.body).toBe('Signed permission email');
    expect(file.headers['content-disposition']).toMatch(/^attachment; filename="permission.txt"/);
    const player = await signIn(t.app, 'subscriber');
    const asPlayer = await t.app.inject({
      url: `${t.base(t.id)}/license/evidence`,
      headers: { authorization: `Bearer ${player.accessToken}` },
    });
    expect([401, 403]).toContain(asPlayer.statusCode);
    const anonymous = await t.app.inject({ url: `${t.base(t.id)}/license/evidence` });
    expect(anonymous.statusCode).toBe(401);
  });
});
