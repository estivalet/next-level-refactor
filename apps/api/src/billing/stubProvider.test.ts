import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../test/testApp.ts';
import { STUB_WEBHOOK_SECRET } from '../env.ts';
import { stubProvider } from './stubProvider.ts';

function setup() {
  const clock = new FakeClock();
  const delivered: Array<{ raw: string; signature: string }> = [];
  const stub = stubProvider({
    publicUrl: 'http://localhost:4000',
    webhookSecret: STUB_WEBHOOK_SECRET,
    clock: clock.read,
    deliver: (raw, signature) => {
      delivered.push({ raw, signature });
      return Promise.resolve(200);
    },
  });
  return { stub, clock, delivered };
}

const CHECKOUT = {
  userId: 'u1',
  email: 'subscriber@nextlevel.test',
  customerId: null,
  priceId: 'price_stub_month_1990_brl',
  successUrl: 'http://localhost:4000/v1/billing/return?result=success',
  cancelUrl: 'http://localhost:4000/v1/billing/return?result=cancelled',
};

describe('billing stub (D32)', () => {
  it('any price_stub_<interval>_<amount>_<currency> is an active recurring price', async () => {
    const { stub } = setup();
    expect(await stub.getPrice('price_stub_year_19900_usd')).toEqual({
      id: 'price_stub_year_19900_usd',
      amount: 19900,
      currency: 'usd',
      interval: 'year',
      active: true,
    });
    await expect(stub.getPrice('price_real')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('checkout opens a page on the API; paying creates the subscription and signed events', async () => {
    const { stub, delivered } = setup();
    const { url } = await stub.createCheckout(CHECKOUT);
    expect(url).toMatch(/^http:\/\/localhost:4000\/v1\/billing\/stub\/checkout\/cs_stub_/);
    const session = url.split('/').at(-1) ?? '';
    const subscription = await stub.pay(session);
    expect(subscription).toMatchObject({
      userId: 'u1',
      status: 'active',
      priceId: CHECKOUT.priceId,
      currentPeriodEnd: '2026-11-25T12:00:00.000Z',
      cancelAtPeriodEnd: false,
    });
    expect(await stub.getSubscription(subscription.id)).toEqual(subscription);
    const events = delivered.map((d) => stub.verifyEvent(Buffer.from(d.raw), d.signature));
    expect(events.map((e) => [e.type, e.subscriptionId])).toEqual([
      ['checkout.session.completed', subscription.id],
      ['customer.subscription.created', subscription.id],
    ]);
    await expect(stub.pay(session)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('a body changed by one byte fails verification', () => {
    const { stub } = setup();
    const raw = JSON.stringify({ id: 'evt_1', type: 'invoice.paid', data: { object: {} } });
    const signature = stub.sign(raw);
    expect(stub.verifyEvent(Buffer.from(raw), signature).id).toBe('evt_1');
    const changed = raw.replace('evt_1', 'evt_2');
    expect(() => stub.verifyEvent(Buffer.from(changed), signature)).toThrow();
    expect(() => stub.verifyEvent(Buffer.from(raw), 't=1,v1=00')).toThrow();
    expect(() => stub.verifyEvent(Buffer.from(raw), 'garbage')).toThrow();
  });

  it('a signature older than 5 minutes fails verification', () => {
    const { stub, clock } = setup();
    const raw = JSON.stringify({ id: 'evt_1', type: 'invoice.paid', data: { object: {} } });
    const signature = stub.sign(raw);
    clock.advance(5 * 60_000 + 1000);
    expect(() => stub.verifyEvent(Buffer.from(raw), signature)).toThrow(/signature/i);
  });

  it('portal actions change the subscription and send customer.subscription.updated', async () => {
    const { stub, delivered } = setup();
    const session = (await stub.createCheckout(CHECKOUT)).url.split('/').at(-1) ?? '';
    const sub = await stub.pay(session);
    delivered.length = 0;
    await stub.act(sub.id, 'cancelAtPeriodEnd');
    expect((await stub.getSubscription(sub.id)).cancelAtPeriodEnd).toBe(true);
    await stub.act(sub.id, 'resume');
    await stub.act(sub.id, 'paymentFails');
    expect((await stub.getSubscription(sub.id)).status).toBe('past_due');
    await stub.act(sub.id, 'renew');
    expect(await stub.getSubscription(sub.id)).toMatchObject({
      status: 'active',
      currentPeriodEnd: '2026-12-25T12:00:00.000Z',
    });
    await stub.act(sub.id, 'switch', 'price_stub_year_19900_brl');
    expect((await stub.getSubscription(sub.id)).priceId).toBe('price_stub_year_19900_brl');
    await stub.cancelNow(sub.id);
    expect((await stub.getSubscription(sub.id)).status).toBe('canceled');
    const types = delivered.map((d) => stub.verifyEvent(Buffer.from(d.raw), d.signature).type);
    expect(types).toEqual([
      'customer.subscription.updated',
      'customer.subscription.updated',
      'invoice.payment_failed',
      'invoice.paid',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ]);
    expect(stub.subscriptionsOf(sub.customerId).map((s) => s.id)).toEqual([sub.id]);
    expect((await stub.createPortal({ customerId: sub.customerId, returnUrl: 'x' })).url).toBe(
      `http://localhost:4000/v1/billing/stub/portal/${sub.customerId}`,
    );
  });
});
