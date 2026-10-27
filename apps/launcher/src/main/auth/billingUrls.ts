const HOSTS = { checkout: 'checkout.stripe.com', portal: 'billing.stripe.com' } as const;

/**
 * The browser is only sent to Stripe's hosted Checkout or Portal, or to the API itself (the
 * billing stub, D32). Anything else the API might answer is refused, never opened.
 */
export function billingUrlAllowed(
  url: string,
  kind: 'checkout' | 'portal',
  apiOrigin: string,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password) return false;
  if (parsed.origin === new URL(apiOrigin).origin) return true;
  return parsed.protocol === 'https:' && parsed.host === HOSTS[kind];
}
