import { afterEach, describe, expect, it } from 'vitest';
import { bearer, signIn } from '../../test/launcherSignIn.ts';
import { createTestApp } from '../../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup(rawEnv: Record<string, string> = {}) {
  const test = await createTestApp({ rawEnv });
  closers.push(test.close);
  const player = await signIn(test.app, 'subscriber');
  const auth = bearer(player.accessToken);
  const get = (kind: string, headers = auth) =>
    test.app.inject({ url: `/v1/sync/${kind}`, headers });
  const put = (kind: string, payload: Record<string, unknown>, headers = auth) =>
    test.app.inject({ method: 'PUT', url: `/v1/sync/${kind}`, headers, payload });
  return { ...test, player, auth, get, put };
}

describe('sync documents (FR-SET-5, D55)', () => {
  it('a kind never written is revision 0 with no data', async () => {
    const t = await setup();
    const response = await t.get('settings');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ revision: 0, data: null, updatedAt: null });
  });

  it('PUT with the current revision → revision + 1; with an old one → 409 with the server copy', async () => {
    const t = await setup();
    const first = await t.put('menus', { baseRevision: 0, data: { a: 1 } });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ revision: 1, updatedAt: t.clock.read().toISOString() });
    t.clock.advance(1000);
    const second = await t.put('menus', { baseRevision: 1, data: { a: 2 } });
    expect(second.json()).toMatchObject({ revision: 2 });
    const stale = await t.put('menus', { baseRevision: 1, data: { a: 3 } });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({
      error: {
        code: 'CONFLICT',
        details: { revision: 2, data: { a: 2 }, updatedAt: t.clock.read().toISOString() },
      },
    });
    // A first write that races another first write also conflicts.
    const raced = await t.put('menus', { baseRevision: 0, data: { a: 4 } });
    expect(raced.statusCode).toBe(409);
    expect((await t.get('menus')).json()).toMatchObject({ revision: 2, data: { a: 2 } });
  });

  it('the server stamps updatedAt (a skewed launcher clock never decides)', async () => {
    const t = await setup();
    const saved = await t.put('settings', {
      baseRevision: 0,
      data: { x: 1 },
      updatedAt: '2099-01-01T00:00:00.000Z',
    });
    // Extra keys are refused rather than trusted.
    expect(saved.statusCode).toBe(400);
    await t.put('settings', { baseRevision: 0, data: { x: 1 } });
    expect((await t.get('settings')).json()).toMatchObject({
      updatedAt: t.clock.read().toISOString(),
    });
  });

  it('GET unknown kind → 400; other user’s documents are never read', async () => {
    const t = await setup();
    expect((await t.get('secrets')).statusCode).toBe(400);
    await t.put('collections', { baseRevision: 0, data: ['mine'] });
    const other = await signIn(t.app, 'admin', 'Other PC');
    const theirs = await t.get('collections', bearer(other.accessToken));
    expect(theirs.json()).toEqual({ revision: 0, data: null, updatedAt: null });
  });

  it('no subscription → SUBSCRIPTION_REQUIRED; suspended → SUSPENDED; no token → UNAUTHENTICATED', async () => {
    const t = await setup({ BILLING_ENABLED: 'true', BILLING_STUB: '1' });
    expect((await t.get('settings')).json()).toMatchObject({
      error: { code: 'SUBSCRIPTION_REQUIRED' },
    });
    t.db.$client
      .prepare("update users set status = 'suspended' where email = ?")
      .run('subscriber@nextlevel.test');
    expect((await t.put('settings', { baseRevision: 0, data: 1 })).json()).toMatchObject({
      error: { code: 'SUSPENDED' },
    });
    expect((await t.app.inject({ url: '/v1/sync/settings' })).statusCode).toBe(401);
  });

  it('after Delete synced data, a launcher with an old revision gets 409 and never overwrites', async () => {
    const t = await setup();
    await t.put('menus', { baseRevision: 0, data: { from: 'B' } });
    // PC B last saw revision 1. The user deletes synced data; PC A writes again.
    await t.app.inject({ method: 'DELETE', url: '/v1/sync', headers: t.auth });
    const fresh = await t.get('menus');
    expect(fresh.json()).toMatchObject({ revision: 2, data: null });
    expect((await t.put('menus', { baseRevision: 2, data: { from: 'A' } })).json()).toMatchObject({
      revision: 3,
    });
    const stale = await t.put('menus', { baseRevision: 1, data: { from: 'B, stale' } });
    expect(stale.statusCode).toBe(409);
    expect((await t.get('menus')).json()).toMatchObject({ revision: 3, data: { from: 'A' } });
  });

  it('data null or missing is refused (400), never a server error', async () => {
    const t = await setup();
    expect((await t.put('settings', { baseRevision: 0, data: null })).statusCode).toBe(400);
    expect((await t.put('settings', { baseRevision: 0 })).statusCode).toBe(400);
  });

  it('6 MiB body → PAYLOAD_TOO_LARGE', async () => {
    const t = await setup();
    const big = 'x'.repeat(6 * 1024 * 1024);
    const response = await t.put('userState', { baseRevision: 0, data: big });
    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
  });

  it('account export includes sync documents; delete account removes them; DELETE /v1/sync clears all', async () => {
    const t = await setup();
    await t.put('settings', { baseRevision: 0, data: { language: 'pt-BR' } });
    await t.put('userState', { baseRevision: 0, data: { games: {} } });
    const exported = (await t.app.inject({ url: '/v1/me/export', headers: t.auth })).json<{
      syncDocuments: Array<{ kind: string; revision: number; data: unknown }>;
    }>();
    expect(exported.syncDocuments).toEqual([
      expect.objectContaining({ kind: 'settings', revision: 1, data: { language: 'pt-BR' } }),
      expect.objectContaining({ kind: 'userState', revision: 1 }),
    ]);

    const cleared = await t.app.inject({ method: 'DELETE', url: '/v1/sync', headers: t.auth });
    expect(cleared.statusCode).toBe(204);
    expect((await t.get('settings')).json()).toMatchObject({ revision: 2, data: null });
    const afterClear = (await t.app.inject({ url: '/v1/me/export', headers: t.auth })).json<{
      syncDocuments: unknown[];
    }>();
    expect(afterClear.syncDocuments).toEqual([]);

    await t.put('menus', { baseRevision: 0, data: [] });
    const deleted = await t.app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: t.auth,
      payload: { confirmEmail: 'subscriber@nextlevel.test' },
    });
    expect(deleted.statusCode).toBe(204);
    const left = t.db.$client.prepare('select count(*) from sync_documents').pluck().get();
    expect(left).toBe(0);
  });
});
