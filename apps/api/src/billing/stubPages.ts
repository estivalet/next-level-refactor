import type { ProviderSubscription } from './provider.ts';
import type { StubAction, StubSession } from './stubProvider.ts';

// The billing stub's fake Checkout and Portal pages (D32, development and tests only). They are
// operator tools, so English only, and every page says no real payment happens.

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} — NextLevel billing stub</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background: #f4f4f6; color: #16181d; }
  header { background: #b42318; color: #fff; padding: .75rem 1rem; font-weight: 700; }
  main { max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }
  form { display: inline; }
  button { margin: .25rem .25rem .25rem 0; padding: .5rem .9rem; }
  section { background: #fff; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
</style>
</head>
<body>
<header>TEST — no real payment (billing stub)</header>
<main>
<h1>${escape(title)}</h1>
${body}
</main>
</body>
</html>
`;
}

const button = (action: string, label: string) =>
  `<form method="post" action="${escape(action)}"><button type="submit">${escape(label)}</button></form>`;

export function checkoutPage(session: StubSession, base: string): string {
  return page(
    'Checkout',
    `<section>
<p>Customer: ${escape(session.email)}</p>
<p>Price: <code>${escape(session.priceId)}</code></p>
${button(`${base}/v1/billing/stub/checkout/${session.id}/pay`, 'Pay')}
<a href="${escape(session.cancelUrl)}">Cancel</a>
</section>`,
  );
}

const ACTIONS: Array<[StubAction, string]> = [
  ['cancelAtPeriodEnd', 'Cancel at period end'],
  ['resume', 'Resume'],
  ['paymentFails', 'Payment fails'],
  ['renew', 'Renew'],
  ['endNow', 'End now'],
];

export function portalPage(
  customerId: string,
  subscriptions: ProviderSubscription[],
  switchPrices: string[],
  base: string,
): string {
  const path = `${base}/v1/billing/stub/portal/${customerId}`;
  const sections = subscriptions.map((sub) => {
    const actions = ACTIONS.map(([action, label]) =>
      button(`${path}/${sub.id}/${action}`, label),
    ).join('\n');
    const switches = switchPrices
      .filter((price) => price !== sub.priceId)
      .map((price) => button(`${path}/${sub.id}/switch/${price}`, `Switch to ${price}`))
      .join('\n');
    return `<section>
<p><code>${escape(sub.id)}</code> — ${escape(sub.status)}${sub.cancelAtPeriodEnd ? ' (cancels at period end)' : ''}</p>
<p>Price <code>${escape(sub.priceId)}</code>, period ends ${escape(sub.currentPeriodEnd)}</p>
${actions}
${switches}
</section>`;
  });
  return page(
    'Customer portal',
    `${sections.join('\n') || '<p>No subscriptions.</p>'}
<p><a href="${escape(`${base}/v1/billing/return?result=portal`)}">Return to NextLevel</a></p>`,
  );
}
