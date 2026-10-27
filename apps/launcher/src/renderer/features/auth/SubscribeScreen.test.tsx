import { err, ok, type AuthState, type PlansResponse } from '@nextlevel/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { createQueryClient } from '../../queryClient.ts';
import { installFakeBridge } from '../../test-utils.tsx';
import { SubscribeScreen } from './SubscribeScreen.tsx';
import { signedIn } from './testing.ts';

afterEach(() => {
  setBridgeForTests(null);
});

type SignedIn = Extract<AuthState, { kind: 'signedIn' }>;
const NONE = signedIn({}, { status: 'none', plan: null }) as SignedIn;

const PLANS: PlansResponse = {
  billingEnabled: true,
  plans: [
    {
      slug: 'basic',
      name: 'Basic',
      deviceLimit: 2,
      scopes: [{ slug: 'demos', name: 'Demo scene' }],
      prices: { month: { amount: 1990, currency: 'brl' }, year: null },
    },
    {
      slug: 'plus',
      name: 'Plus',
      deviceLimit: 5,
      scopes: [],
      prices: {
        month: { amount: 2990, currency: 'brl' },
        year: { amount: 29900, currency: 'brl' },
      },
    },
  ],
};

function setup(
  state: SignedIn = NONE,
  plans: PlansResponse = PLANS,
  extra: Parameters<typeof installFakeBridge>[0] = {},
) {
  const fake = installFakeBridge({
    'auth.state': () => ok(state),
    'auth.plans': () => ok(plans),
    'auth.openCheckout': () => ok({ ...state, waitingForPayment: true }),
    'auth.stopWaiting': () => ok({ ...state, waitingForPayment: false }),
    'auth.refreshEntitlement': () => ok(state),
    'auth.signOut': () => ok({ kind: 'signedOut', reason: null, banner: null }),
    ...extra,
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SubscribeScreen state={state} />
    </QueryClientProvider>,
  );
  return fake;
}

describe('S3 Subscribe (US-A2, FR-AUTH-3)', () => {
  it('billing off keeps the "not open yet" notice with Sign out', async () => {
    setup(NONE, { billingEnabled: false, plans: [] });
    expect(
      await screen.findByRole('heading', { name: "Subscriptions aren't open yet" }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  it('one card per plan with price, devices and scopes; the first Choose has focus', async () => {
    setup();
    const basic = await screen.findByRole('article', { name: 'Basic' });
    expect(within(basic).getByText(/19\.90/)).toBeVisible();
    expect(within(basic).getByText(/month/i)).toBeVisible();
    expect(within(basic).getByText('Devices: 2')).toBeVisible();
    expect(within(basic).getByText('Demo scene')).toBeVisible();
    expect(screen.getByRole('article', { name: 'Plus' })).toBeVisible();
    expect(within(basic).getByRole('button', { name: 'Choose Basic' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Monthly' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Year mode: a plan without a yearly price says "Monthly only" and cannot be chosen', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('button', { name: 'Yearly' }));
    const basic = screen.getByRole('article', { name: 'Basic' });
    expect(within(basic).getByText('Monthly only')).toBeVisible();
    expect(within(basic).getByRole('button', { name: 'Choose Basic' })).toBeDisabled();
    const plus = screen.getByRole('article', { name: 'Plus' });
    expect(within(plus).getByText(/299\.00/)).toBeVisible();
  });

  it('Choose opens checkout with the plan and interval', async () => {
    const user = userEvent.setup();
    const fake = setup();
    await user.click(await screen.findByRole('button', { name: 'Yearly' }));
    await user.click(screen.getByRole('button', { name: 'Choose Plus' }));
    expect(fake.calls.find((c) => c.channel === 'auth.openCheckout')?.input).toEqual({
      planSlug: 'plus',
      interval: 'year',
    });
  });

  it("while waiting: progress, I've already paid, Choose another plan, and Sign out", async () => {
    const user = userEvent.setup();
    const fake = setup({ ...NONE, waitingForPayment: true });
    expect(await screen.findByText('Waiting for your payment…')).toBeVisible();
    expect(screen.getByRole('progressbar')).toBeVisible();
    await user.click(screen.getByRole('button', { name: "I've already paid" }));
    await user.click(screen.getByRole('button', { name: 'Choose another plan' }));
    expect(fake.channels()).toEqual(
      expect.arrayContaining(['auth.refreshEntitlement', 'auth.stopWaiting']),
    );
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  it('a failed checkout is explained', async () => {
    const user = userEvent.setup();
    setup(NONE, PLANS, {
      'auth.openCheckout': () => err('BILLING_UNAVAILABLE', 'errors.billingUnavailable'),
    });
    await user.click(await screen.findByRole('button', { name: 'Choose Basic' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Billing is unavailable');
  });
});
