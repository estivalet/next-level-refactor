const HOSTS = { checkout: 'checkout.stripe.com', portal: 'billing.stripe.com' } as const;

/**
 * The browser is only sent to Stripe's hosted Checkout or Portal, or to the API itself (the
 * billing stub, D32). Answers the URL to open — the parsed `href`, so the browser gets exactly
 * what was checked — or null for anything else the API might answer.
 */
export function billingUrl(
  url: string,
  kind: 'checkout' | 'portal',
  apiOrigin: string,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password) return null;
  if (parsed.origin === new URL(apiOrigin).origin) return parsed.href;
  return parsed.protocol === 'https:' && parsed.host === HOSTS[kind] ? parsed.href : null;
}

export function billingUrlAllowed(
  url: string,
  kind: 'checkout' | 'portal',
  apiOrigin: string,
): boolean {
  return billingUrl(url, kind, apiOrigin) !== null;
}
