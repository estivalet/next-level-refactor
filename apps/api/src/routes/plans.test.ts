import type { AdminPlan, CatalogScope, Entitlement, PlansResponse } from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { adminHeaders, adminSignIn } from '../../test/adminSignIn.ts';
import { fakeBilling, PRICES } from '../../test/fakeBilling.ts';
import { bearer, signIn } from '../../test/launcherSignIn.ts';
import { createTestApp } from '../../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup(rawEnv: Record<string, string> = {}) {
  const test = await createTestApp({ billing: fakeBilling(Object.values(PRICES)), rawEnv });
  closers.push(test.close);
  const admin = await adminSignIn(test.app, 'admin');
  const send = async <T>(method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) => {
    const response = await test.app.inject({
      method,
      url,
      headers: adminHeaders(admin, method !== 'GET'),
      ...(payload === undefined ? {} : { payload }),
    });
    return response.json<T>();
  };
  return { ...test, send };
}

describe('GET /v1/plans (FR-SUB-1, S3)', () => {
  it('lists, without sign-in, the plans on sale with prices and scope names', async () => {
    const { app, send } = await setup();
    const scope = await send<CatalogScope>('POST', '/v1/admin/scopes', {
      slug: 'demos',
      name: 'Demos',
      description: 'Demo scene',
    });
    await send('POST', '/v1/admin/plans', {
      slug: 'basic',
      name: 'Basic',
      deviceLimit: 2,
      scopeIds: [scope.id],
      stripePriceMonthly: PRICES.basicMonthBrl.id,
    });
    await send('POST', '/v1/admin/plans', {
      slug: 'unpriced',
      name: 'Unpriced',
      deviceLimit: 1,
      scopeIds: [],
    });
    const response = await app.inject({ url: '/v1/plans' });
    expect(response.statusCode).toBe(200);
    expect(response.json<PlansResponse>()).toEqual({
      billingEnabled: false,
      plans: [
        {
          slug: 'basic',
          name: 'Basic',
          deviceLimit: 2,
          scopes: [{ slug: 'demos', name: 'Demos' }],
          prices: { month: { amount: 1990, currency: 'brl' }, year: null },
        },
      ],
    });
  });

  it('billingEnabled mirrors BILLING_ENABLED', async () => {
    const { app } = await setup({ BILLING_ENABLED: 'true', BILLING_STUB: '1' });
    expect((await app.inject({ url: '/v1/plans' })).json<PlansResponse>().billingEnabled).toBe(
      true,
    );
  });

  it('Review Focus 5: an archived plan leaves the list', async () => {
    const { app, send } = await setup();
    const plan = await send<AdminPlan>('POST', '/v1/admin/plans', {
      slug: 'basic',
      name: 'Basic',
      deviceLimit: 2,
      scopeIds: [],
      stripePriceYearly: PRICES.basicYearBrl.id,
    });
    expect((await app.inject({ url: '/v1/plans' })).json<PlansResponse>().plans).toHaveLength(1);
    await send('PATCH', `/v1/admin/plans/${plan.id}`, { archived: true });
    expect((await app.inject({ url: '/v1/plans' })).json<PlansResponse>().plans).toEqual([]);
  });

  it("Review Focus 5: a plan's new scopes reach its users at their next check, as slugs", async () => {
    const { app, send } = await setup();
    const session = await signIn(app, 'subscriber');
    const scope = await send<CatalogScope>('POST', '/v1/admin/scopes', {
      slug: 'demos',
      name: 'Demos',
      description: '',
    });
    const plans = await send<AdminPlan[]>('GET', '/v1/admin/plans');
    await send('PATCH', `/v1/admin/plans/${plans[0]?.id ?? ''}`, { scopeIds: [scope.id] });
    const check = await app.inject({
      url: '/v1/me/entitlement',
      headers: bearer(session.accessToken),
    });
    expect(check.json<{ entitlement: Entitlement }>().entitlement.scopes).toEqual(['demos']);
  });
});
