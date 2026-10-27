import { describe, expect, it } from 'vitest';
import { billingUrlAllowed } from './billingUrls.ts';

const API = 'http://localhost:4000';

describe('billing URL allow-list (Global Constraints, security §2)', () => {
  it('Checkout opens only on checkout.stripe.com or the API (stub)', () => {
    expect(billingUrlAllowed('https://checkout.stripe.com/c/pay/x', 'checkout', API)).toBe(true);
    expect(billingUrlAllowed(`${API}/v1/billing/stub/checkout/cs_1`, 'checkout', API)).toBe(true);
    expect(billingUrlAllowed('https://billing.stripe.com/p/session/x', 'checkout', API)).toBe(
      false,
    );
  });

  it('the Portal opens only on billing.stripe.com or the API (stub)', () => {
    expect(billingUrlAllowed('https://billing.stripe.com/p/session/x', 'portal', API)).toBe(true);
    expect(billingUrlAllowed(`${API}/v1/billing/stub/portal/cus_1`, 'portal', API)).toBe(true);
    expect(billingUrlAllowed('https://checkout.stripe.com/c/pay/x', 'portal', API)).toBe(false);
  });

  it.each([
    'https://evil.test/c/pay/x',
    'http://checkout.stripe.com/c/pay/x',
    'https://checkout.stripe.com.evil.test/x',
    'https://checkout.stripe.com:8443/x',
    'https://user@evil.test/x',
    'javascript:alert(1)',
    'not a url',
  ])('%s is refused', (url) => {
    expect(billingUrlAllowed(url, 'checkout', API)).toBe(false);
  });
});
