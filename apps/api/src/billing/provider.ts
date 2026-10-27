// The billing provider behind the API (ADR-009, D31/D32): Stripe in test mode, or the stub.
// M8a only reads prices; checkout, portal and subscriptions arrive with the providers (M8b).

/** A recurring price as the provider reports it: minor units, lowercase ISO 4217 currency. */
export interface ProviderPrice {
  id: string;
  amount: number;
  currency: string;
  /** Null for a one-time price. */
  interval: 'month' | 'year' | null;
  active: boolean;
}

export interface BillingProvider {
  /** Rejects with `VALIDATION_FAILED` for an unknown price, `BILLING_UNAVAILABLE` when down. */
  getPrice(priceId: string): Promise<ProviderPrice>;
}
