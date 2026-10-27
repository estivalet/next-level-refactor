import type { BillingProvider, ProviderPrice } from '../src/billing/provider.ts';
import { apiError } from '../src/errors.ts';

/** Prices a test can read through `ctx.billing`; an unknown id is refused like Stripe would. */
export function fakeBilling(prices: ProviderPrice[] = []): BillingProvider {
  const byId = new Map(prices.map((price) => [price.id, price]));
  return {
    getPrice: (id) => {
      const price = byId.get(id);
      if (!price)
        return Promise.reject(apiError('VALIDATION_FAILED', undefined, { reason: 'unknownPrice' }));
      return Promise.resolve(price);
    },
  };
}

export const PRICES = {
  basicMonthBrl: {
    id: 'price_basic_m',
    amount: 1990,
    currency: 'brl',
    interval: 'month',
    active: true,
  },
  basicYearBrl: {
    id: 'price_basic_y',
    amount: 19900,
    currency: 'brl',
    interval: 'year',
    active: true,
  },
  basicYearUsd: {
    id: 'price_basic_y_usd',
    amount: 3900,
    currency: 'usd',
    interval: 'year',
    active: true,
  },
  oldMonth: { id: 'price_old_m', amount: 990, currency: 'brl', interval: 'month', active: false },
} satisfies Record<string, ProviderPrice>;
