import { err, ok, type AuthState, type PlansResponse, type Result } from '@nextlevel/shared';
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
  const client = createQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <SubscribeScreen state={state} />
    </QueryClientProvider>,
  );
  const rerender = (next: SignedIn) => {
    view.rerender(
      <QueryClientProvider client={client}>
        <SubscribeScreen state={next} />
      </QueryClientProvider>,
    );
  };
  return { ...fake, rerender };
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

  it('plans that failed to load can be loaded again', async () => {
    const user = userEvent.setup();
    let calls = 0;
    setup(NONE, PLANS, {
      'auth.plans': () => {
        calls += 1;
        return calls === 1 ? err('API_UNREACHABLE', 'errors.apiUnreachable') : ok(PLANS);
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach NextLevel");
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('article', { name: 'Basic' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

describe('Subscribe errors and focus (M8c minors)', () => {
  it("I've already paid / Choose another plan errors are shown", async () => {
    const user = userEvent.setup();
    setup({ ...NONE, waitingForPayment: true }, PLANS, {
      'auth.refreshEntitlement': () => err('API_UNREACHABLE', 'errors.apiUnreachable'),
      'auth.stopWaiting': () => err('INTERNAL', 'errors.internal'),
    });
    await user.click(await screen.findByRole('button', { name: "I've already paid" }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach NextLevel");
    await user.click(screen.getByRole('button', { name: 'Choose another plan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it("after 2 minutes the Waiting view says we haven't seen the payment yet", async () => {
    const { rerender } = setup({ ...NONE, waitingForPayment: true });
    expect(await screen.findByText('Waiting for your payment…')).toBeVisible();
    rerender({ ...NONE, waitingForPayment: false });
    expect(await screen.findByText(/haven't seen your payment yet/)).toBeVisible();
  });

  it('Choose another plan does not say the payment was not seen', async () => {
    const user = userEvent.setup();
    const { rerender } = setup({ ...NONE, waitingForPayment: true });
    await user.click(await screen.findByRole('button', { name: 'Choose another plan' }));
    rerender({ ...NONE, waitingForPayment: false });
    expect(await screen.findByRole('article', { name: 'Basic' })).toBeVisible();
    expect(screen.queryByText(/haven't seen your payment yet/)).toBeNull();
  });

  it('pending buttons use aria-disabled and keep focus', async () => {
    const user = userEvent.setup();
    setup(NONE, PLANS, { 'auth.openCheckout': () => new Promise(() => undefined) });
    const choose = await screen.findByRole('button', { name: 'Choose Basic' });
    await user.click(choose);
    expect(choose).toHaveAttribute('aria-disabled', 'true');
    // It looks pending too, not only to a screen reader.
    expect(choose).toHaveClass('aria-disabled:opacity-50');
    expect(choose).not.toBeDisabled();
    expect(choose).toHaveFocus();
  });

  it('a browser that would not open is explained', async () => {
    const user = userEvent.setup();
    setup(NONE, PLANS, {
      'auth.openCheckout': () => err('INTERNAL', 'errors.internal', { reason: 'browser' }),
    });
    await user.click(await screen.findByRole('button', { name: 'Choose Basic' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't open your browser");
  });

  it('with billing off, the not-open notice shows without a Choose a plan flash', async () => {
    let answer: (value: Result<PlansResponse>) => void = () => undefined;
    setup(NONE, PLANS, {
      'auth.plans': () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    });
    expect(await screen.findByText('Loading plans…')).toBeVisible();
    expect(screen.queryByText('Choose a plan')).toBeNull();
    answer(ok({ billingEnabled: false, plans: [] }));
    expect(await screen.findByText("Subscriptions aren't open yet")).toBeVisible();
  });
});
