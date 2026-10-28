import type { AdminPlan, AuditEntry, CatalogScope } from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { adminHeaders, adminSignIn } from '../../test/adminSignIn.ts';
import { signIn } from '../../test/launcherSignIn.ts';
import { fakeBilling, PRICES } from '../../test/fakeBilling.ts';
import { createTestApp } from '../../test/testApp.ts';
import type { BillingProvider } from '../billing/provider.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup(billing: BillingProvider | null = fakeBilling(Object.values(PRICES))) {
  const test = await createTestApp({ billing });
  closers.push(test.close);
  const admin = await adminSignIn(test.app, 'admin');
  const send = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown) =>
    test.app.inject({
      method,
      url,
      headers: adminHeaders(admin, method !== 'GET'),
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });
  return { ...test, admin, send };
}

const BASIC = { slug: 'basic', name: 'Basic', deviceLimit: 2, scopeIds: [] };

describe('admin plans (FR-SUB-1, FR-ADM-2)', () => {
  it('creating a plan returns it and writes plan.create with the new plan', async () => {
    const { send } = await setup();
    const created = await send('POST', '/v1/admin/plans', BASIC);
    expect(created.statusCode).toBe(200);
    const plan = created.json<AdminPlan>();
    expect(plan).toMatchObject({
      ...BASIC,
      stripePriceMonthly: null,
      stripePriceYearly: null,
      prices: { month: null, year: null },
      archived: false,
      subscribers: 0,
    });
    const audit = await send('GET', `/v1/admin/audit?target=${plan.id}`);
    expect(audit.json<{ items: AuditEntry[] }>().items).toEqual([
      expect.objectContaining({
        action: 'plan.create',
        targetType: 'plan',
        before: null,
        after: expect.objectContaining({ slug: 'basic' }) as unknown,
      }),
    ]);
    const list = await send('GET', '/v1/admin/plans');
    expect(list.json<AdminPlan[]>().map((p) => p.slug)).toEqual(['default', 'basic']);
  });

  it('a duplicate slug is CONFLICT slugTaken; an unknown scope is VALIDATION_FAILED', async () => {
    const { send } = await setup();
    await send('POST', '/v1/admin/plans', BASIC);
    const duplicate = await send('POST', '/v1/admin/plans', BASIC);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'slugTaken' } },
    });
    const unknown = await send('POST', '/v1/admin/plans', {
      ...BASIC,
      slug: 'other',
      scopeIds: ['nope'],
    });
    expect(unknown.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('a good price id stores amount and currency read from the provider', async () => {
    const { send } = await setup();
    const created = await send('POST', '/v1/admin/plans', {
      ...BASIC,
      stripePriceMonthly: PRICES.basicMonthBrl.id,
      stripePriceYearly: PRICES.basicYearBrl.id,
    });
    expect(created.json<AdminPlan>().prices).toEqual({
      month: { amount: 1990, currency: 'brl' },
      year: { amount: 19900, currency: 'brl' },
    });
  });

  it.each([
    ['interval', { stripePriceMonthly: PRICES.basicYearBrl.id }],
    ['inactive', { stripePriceMonthly: PRICES.oldMonth.id }],
    [
      'currency',
      { stripePriceMonthly: PRICES.basicMonthBrl.id, stripePriceYearly: PRICES.basicYearUsd.id },
    ],
  ])('a bad price is VALIDATION_FAILED %s and nothing is saved', async (reason, prices) => {
    const { send } = await setup();
    const response = await send('POST', '/v1/admin/plans', { ...BASIC, ...prices });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED', details: { reason } },
    });
    const list = await send('GET', '/v1/admin/plans');
    expect(list.json<AdminPlan[]>().map((p) => p.slug)).toEqual(['default']);
  });

  it('a price edit is checked against the price already on the plan', async () => {
    const { send } = await setup();
    const plan = (
      await send('POST', '/v1/admin/plans', {
        ...BASIC,
        stripePriceMonthly: PRICES.basicMonthBrl.id,
      })
    ).json<AdminPlan>();
    const usd = await send('PATCH', `/v1/admin/plans/${plan.id}`, {
      stripePriceYearly: PRICES.basicYearUsd.id,
    });
    expect(usd.json()).toMatchObject({ error: { details: { reason: 'currency' } } });
    const cleared = await send('PATCH', `/v1/admin/plans/${plan.id}`, {
      stripePriceMonthly: null,
      stripePriceYearly: PRICES.basicYearUsd.id,
    });
    expect(cleared.json<AdminPlan>().prices).toEqual({
      month: null,
      year: { amount: 3900, currency: 'usd' },
    });
  });

  it('a price id already on another plan, archived or not, is CONFLICT priceTaken', async () => {
    const { send } = await setup();
    const old = (
      await send('POST', '/v1/admin/plans', {
        ...BASIC,
        stripePriceMonthly: PRICES.basicMonthBrl.id,
      })
    ).json<AdminPlan>();
    await send('PATCH', `/v1/admin/plans/${old.id}`, { archived: true });
    const copy = await send('POST', '/v1/admin/plans', {
      ...BASIC,
      slug: 'copy',
      stripePriceMonthly: PRICES.basicMonthBrl.id,
    });
    expect(copy.json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'priceTaken' } },
    });
    const other = (
      await send('POST', '/v1/admin/plans', { ...BASIC, slug: 'other' })
    ).json<AdminPlan>();
    const patch = await send('PATCH', `/v1/admin/plans/${other.id}`, {
      stripePriceMonthly: PRICES.basicMonthBrl.id,
    });
    expect(patch.json()).toMatchObject({ error: { details: { reason: 'priceTaken' } } });
    // Saving a plan that keeps its own price is fine.
    const same = await send('PATCH', `/v1/admin/plans/${old.id}`, { name: 'Basic (old)' });
    expect(same.statusCode).toBe(200);
  });

  it('without a billing provider a price id is CONFLICT billingOff', async () => {
    const { send } = await setup(null);
    const response = await send('POST', '/v1/admin/plans', {
      ...BASIC,
      stripePriceMonthly: PRICES.basicMonthBrl.id,
    });
    expect(response.json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'billingOff' } },
    });
  });

  it('patching writes plan.update with before and after; the Default plan cannot be archived', async () => {
    const { send } = await setup();
    const plans = (await send('GET', '/v1/admin/plans')).json<AdminPlan[]>();
    const defaultPlan = plans[0];
    if (!defaultPlan) throw new Error('no Default plan');
    const archive = await send('PATCH', `/v1/admin/plans/${defaultPlan.id}`, { archived: true });
    expect(archive.json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'defaultPlan' } },
    });
    const renamed = await send('PATCH', `/v1/admin/plans/${defaultPlan.id}`, { deviceLimit: 4 });
    expect(renamed.json<AdminPlan>().deviceLimit).toBe(4);
    const audit = await send('GET', `/v1/admin/audit?target=${defaultPlan.id}`);
    expect(audit.json<{ items: AuditEntry[] }>().items).toEqual([
      expect.objectContaining({
        action: 'plan.update',
        before: expect.objectContaining({ deviceLimit: 3 }) as unknown,
        after: expect.objectContaining({ deviceLimit: 4 }) as unknown,
      }),
    ]);
    const missing = await send('PATCH', '/v1/admin/plans/nope', { deviceLimit: 4 });
    expect(missing.statusCode).toBe(404);
  });
});

describe('catalog scopes (US-F4, D37)', () => {
  it('create and patch are audited; a duplicate slug is CONFLICT', async () => {
    const { send } = await setup();
    const created = await send('POST', '/v1/admin/scopes', {
      slug: 'homebrew-8bit',
      name: '8-bit homebrew',
      description: '',
    });
    const scope = created.json<CatalogScope>();
    expect(scope).toMatchObject({ slug: 'homebrew-8bit', name: '8-bit homebrew' });
    const duplicate = await send('POST', '/v1/admin/scopes', {
      slug: 'homebrew-8bit',
      name: 'Again',
      description: '',
    });
    expect(duplicate.json()).toMatchObject({
      error: { code: 'CONFLICT', details: { reason: 'slugTaken' } },
    });
    const patched = await send('PATCH', `/v1/admin/scopes/${scope.id}`, { name: '8-bit' });
    expect(patched.json<CatalogScope>().name).toBe('8-bit');
    const list = await send('GET', '/v1/admin/scopes');
    expect(list.json<CatalogScope[]>()).toEqual([{ ...scope, name: '8-bit' }]);
    const audit = await send('GET', `/v1/admin/audit?target=${scope.id}`);
    expect(audit.json<{ items: AuditEntry[] }>().items.map((e) => e.action)).toEqual([
      'scope.update',
      'scope.create',
    ]);
    expect((await send('PATCH', '/v1/admin/scopes/nope', { name: 'x' })).statusCode).toBe(404);
  });

  it('a plan takes existing scope ids', async () => {
    const { send } = await setup();
    const scope = (
      await send('POST', '/v1/admin/scopes', { slug: 'demos', name: 'Demos', description: '' })
    ).json<CatalogScope>();
    const plan = await send('POST', '/v1/admin/plans', { ...BASIC, scopeIds: [scope.id] });
    expect(plan.json<AdminPlan>().scopeIds).toEqual([scope.id]);
  });
});

describe('plan and scope routes are admin only (security §2)', () => {
  it('a demoted admin is FORBIDDEN on every plan and scope route', async () => {
    const { app, admin, db } = await setup();
    db.$client
      .prepare("update users set role = 'subscriber' where email = 'admin@nextlevel.test'")
      .run();
    const scope = { slug: 'demos', name: 'Demos', description: '' };
    const routes = [
      ['GET', '/v1/admin/plans', undefined],
      ['POST', '/v1/admin/plans', BASIC],
      ['PATCH', '/v1/admin/plans/x', {}],
      ['GET', '/v1/admin/scopes', undefined],
      ['POST', '/v1/admin/scopes', scope],
      ['PATCH', '/v1/admin/scopes/x', {}],
    ] as const;
    for (const [method, url, payload] of routes) {
      const response = await app.inject({
        method,
        url,
        headers: adminHeaders(admin, method !== 'GET'),
        ...(payload === undefined ? {} : { payload }),
      });
      expect(response.json(), `${method} ${url}`).toMatchObject({ error: { code: 'FORBIDDEN' } });
    }
  });
});

describe('subscriber counts (M8a minor)', () => {
  async function withRows() {
    const test = await setup();
    const plan = (await test.send('POST', '/v1/admin/plans', BASIC)).json<AdminPlan>();
    await signIn(test.app, 'subscriber');
    await signIn(test.app, 'suspended').catch(() => undefined);
    const idOf = (email: string) =>
      test.db.$client.prepare('select id from users where email = ?').pluck().get(email) as string;
    const insert = (id: string, userId: string, source: 'comp' | 'stripe', status: string) =>
      test.db.$client
        .prepare(
          `insert into subscriptions (id, user_id, plan_id, source, status, stripe_subscription_id,
             created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          userId,
          plan.id,
          source,
          status,
          source === 'stripe' ? `sub_${id}` : null,
          '2026-10-01T00:00:00.000Z',
          '2026-10-01T00:00:00.000Z',
        );
    const count = async () =>
      (await test.send('GET', '/v1/admin/plans'))
        .json<AdminPlan[]>()
        .find((p) => p.slug === 'basic')?.subscribers;
    return { ...test, idOf, insert, count };
  }

  it('subscriber counts count users, not rows (two rows for one user count 1)', async () => {
    const { idOf, insert, count } = await withRows();
    const user = idOf('subscriber@nextlevel.test');
    insert('s1', user, 'comp', 'active');
    insert('s2', user, 'stripe', 'active');
    expect(await count()).toBe(1);
  });

  it('suspended users are not counted', async () => {
    const { idOf, insert, count } = await withRows();
    insert('s1', idOf('suspended@nextlevel.test'), 'stripe', 'active');
    expect(await count()).toBe(0);
  });
});
