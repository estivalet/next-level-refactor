import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPage, stubApi, user } from '../test-utils.tsx';
import { UserDetailPage } from './UserDetailPage.tsx';
import { UsersPage } from './UsersPage.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

const ENTITLEMENT = {
  userId: 'u2',
  role: 'subscriber',
  status: 'active',
  plan: { slug: 'basic', name: 'Basic', deviceLimit: 2 },
  scopes: [],
  checkedAt: '2026-10-25T12:00:00.000Z',
  offlineUntil: '2026-11-08T12:00:00.000Z',
};

const sub = (overrides: Record<string, unknown> = {}) => ({
  id: 's1',
  source: 'stripe',
  status: 'active',
  plan: { slug: 'basic', name: 'Basic' },
  periodEnd: '2026-11-12T12:00:00.000Z',
  cancelAtPeriodEnd: false,
  interval: 'month',
  stripeSubscriptionId: 'sub_123',
  grantedBy: null,
  note: null,
  createdAt: '2026-10-12T12:00:00.000Z',
  ...overrides,
});

const PLANS = [
  {
    id: 'p1',
    slug: 'basic',
    name: 'Basic',
    deviceLimit: 2,
    scopeIds: [],
    stripePriceMonthly: null,
    stripePriceYearly: null,
    prices: { month: null, year: null },
    archived: false,
    subscribers: 1,
  },
  {
    id: 'p2',
    slug: 'old',
    name: 'Old',
    deviceLimit: 1,
    scopeIds: [],
    stripePriceMonthly: null,
    stripePriceYearly: null,
    prices: { month: null, year: null },
    archived: true,
    subscribers: 0,
  },
];

const detail = (subscriptions: unknown[]) => ({
  ...user('u2', 'player@example.test'),
  suspendedReason: null,
  entitlement: ENTITLEMENT,
  devices: [],
  audit: [],
  subscriptions,
});

const conflict = (reason: string) => ({
  status: 409,
  body: { error: { code: 'CONFLICT', message: 'm', requestId: 'r', details: { reason } } },
});

describe('Subscription panel (S13, FR-SUB-4, US-F2)', () => {
  it('shows the current subscription with its Stripe id, and the history', async () => {
    stubApi({
      'GET /v1/admin/users/u2': () => ({
        body: detail([
          sub(),
          sub({
            id: 's0',
            source: 'comp',
            status: 'canceled',
            stripeSubscriptionId: null,
            interval: null,
            grantedBy: { id: 'a1', email: 'admin@example.test' },
            note: 'Beta',
          }),
        ]),
      }),
      'GET /v1/admin/plans': () => ({ body: PLANS }),
    });
    renderPage(<UserDetailPage id="u2" />);
    const panel = await screen.findByRole('region', { name: 'Subscription' });
    expect(within(panel).getByText(/Stripe · Basic · Active/)).toBeVisible();
    expect(within(panel).getByText('sub_123')).toBeVisible();
    const history = within(panel).getByRole('table', { name: 'Subscription history' });
    expect(within(history).getByText('Beta')).toBeVisible();
    expect(within(history).getByText('admin@example.test')).toBeVisible();
  });

  it('Grant complimentary access: plans not archived, optional end, note required', async () => {
    const u = userEvent.setup();
    const calls = stubApi({
      'GET /v1/admin/users/u2': () => ({ body: detail([]) }),
      'GET /v1/admin/plans': () => ({ body: PLANS }),
      'POST /v1/admin/users/u2/grants': () => ({
        body: sub({ source: 'comp', stripeSubscriptionId: null, interval: null }),
      }),
    });
    renderPage(<UserDetailPage id="u2" />);
    const panel = await screen.findByRole('region', { name: 'Subscription' });
    expect(within(panel).getByText('No subscription.')).toBeVisible();
    await u.click(within(panel).getByRole('button', { name: 'Grant complimentary access' }));
    const dialog = screen.getByRole('dialog', { name: 'Grant complimentary access' });
    const select = within(dialog).getByLabelText('Plan');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Basic']);
    const grant = within(dialog).getByRole('button', { name: 'Grant' });
    expect(grant).toBeDisabled();
    await u.type(within(dialog).getByLabelText('Until (optional)'), '2027-01-31');
    await u.type(within(dialog).getByLabelText('Note'), 'Beta tester');
    await u.click(grant);
    await waitFor(() => {
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
        planSlug: 'basic',
        expiresAt: '2027-01-31T23:59:59.999Z',
        note: 'Beta tester',
      });
    });
  });

  it('subscribed is explained in the dialog', async () => {
    const u = userEvent.setup();
    stubApi({
      'GET /v1/admin/users/u2': () => ({ body: detail([]) }),
      'GET /v1/admin/plans': () => ({ body: PLANS }),
      'POST /v1/admin/users/u2/grants': () => conflict('subscribed'),
    });
    renderPage(<UserDetailPage id="u2" />);
    await u.click(await screen.findByRole('button', { name: 'Grant complimentary access' }));
    const dialog = screen.getByRole('dialog', { name: 'Grant complimentary access' });
    await u.type(within(dialog).getByLabelText('Note'), 'x');
    await u.click(within(dialog).getByRole('button', { name: 'Grant' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'This user pays through Stripe — they must cancel first.',
    );
  });

  it('Revoke on an active grant asks first, then revokes', async () => {
    const u = userEvent.setup();
    const calls = stubApi({
      'GET /v1/admin/users/u2': () => ({
        body: detail([
          sub({
            id: 'c1',
            source: 'comp',
            stripeSubscriptionId: null,
            interval: null,
            periodEnd: null,
          }),
        ]),
      }),
      'GET /v1/admin/plans': () => ({ body: PLANS }),
      'DELETE /v1/admin/users/u2/grants/c1': () => ({ status: 204 }),
    });
    renderPage(<UserDetailPage id="u2" />);
    const panel = await screen.findByRole('region', { name: 'Subscription' });
    expect(within(panel).getByText(/Complimentary · Basic · Active · until revoked/)).toBeVisible();
    await u.click(within(panel).getByRole('button', { name: 'Revoke grant' }));
    const confirm = screen.getByRole('dialog', { name: 'Revoke the complimentary access?' });
    await u.click(within(confirm).getByRole('button', { name: 'Revoke grant' }));
    await waitFor(() => {
      expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
    });
  });
});

describe('revoke refusals (review)', () => {
  it('a grant that already ended is explained, not a generic conflict', async () => {
    const u = userEvent.setup();
    stubApi({
      'GET /v1/admin/users/u2': () => ({
        body: detail([
          sub({
            id: 'c1',
            source: 'comp',
            stripeSubscriptionId: null,
            interval: null,
            periodEnd: null,
          }),
        ]),
      }),
      'GET /v1/admin/plans': () => ({ body: PLANS }),
      'DELETE /v1/admin/users/u2/grants/c1': () => conflict('notActive'),
    });
    renderPage(<UserDetailPage id="u2" />);
    const panel = await screen.findByRole('region', { name: 'Subscription' });
    await u.click(within(panel).getByRole('button', { name: 'Revoke grant' }));
    const confirm = screen.getByRole('dialog', { name: 'Revoke the complimentary access?' });
    await u.click(within(confirm).getByRole('button', { name: 'Revoke grant' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'This grant has already ended.',
    );
  });
});

describe('Delete account (D36)', () => {
  it('asks for the email, deletes, and goes back to Users', async () => {
    const u = userEvent.setup();
    window.location.hash = '#/users/u2';
    const calls = stubApi({
      'GET /v1/admin/users/u2': () => ({ body: detail([]) }),
      'GET /v1/admin/plans': () => ({ body: PLANS }),
      'DELETE /v1/admin/users/u2': () => ({ status: 204 }),
    });
    renderPage(<UserDetailPage id="u2" />);
    await u.click(await screen.findByRole('button', { name: 'Delete account…' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete player@example.test?' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete account' });
    expect(confirm).toBeDisabled();
    await u.type(within(dialog).getByLabelText('Type the email to confirm'), 'Player@Example.test');
    await u.click(confirm);
    await waitFor(() => {
      expect(window.location.hash).toBe('#/users');
    });
    expect(calls.find((c) => c.method === 'DELETE')?.body).toEqual({
      confirmEmail: 'Player@Example.test',
    });
  });

  it('is not offered for admins', async () => {
    stubApi({
      'GET /v1/admin/users/u2': () => ({ body: { ...detail([]), role: 'admin' } }),
      'GET /v1/admin/plans': () => ({ body: PLANS }),
    });
    renderPage(<UserDetailPage id="u2" />);
    await screen.findByRole('region', { name: 'Subscription' });
    expect(screen.queryByRole('button', { name: 'Delete account…' })).not.toBeInTheDocument();
  });
});

describe('Users filters (D38)', () => {
  it('access and plan filters go to the API; the plan column comes from the entitlement', async () => {
    const u = userEvent.setup();
    const calls = stubApi({
      'GET /v1/admin/users': () => ({
        body: {
          items: [user('u2', 'player@example.test', { plan: { slug: 'basic', name: 'Basic' } })],
          nextCursor: null,
        },
      }),
      'GET /v1/admin/plans': () => ({ body: PLANS }),
    });
    renderPage(<UsersPage />);
    const row = (await screen.findByText('player@example.test')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Basic')).toBeVisible();
    const access = screen.getByLabelText('Access');
    expect(
      within(access)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['All', 'Active', 'Payment failed', 'No access', 'Complimentary']);
    await u.selectOptions(access, 'none');
    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('access=none'))).toBe(true);
    });
    await u.selectOptions(screen.getByLabelText('Plan'), 'basic');
    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('plan=basic'))).toBe(true);
    });
  });
});

const COMP = () =>
  sub({ id: 'c1', source: 'comp', stripeSubscriptionId: null, interval: null, periodEnd: null });

describe('grant and revoke polish (M8d minors)', () => {
  it('after a revoke, focus moves to the Grant button', async () => {
    const u = userEvent.setup();
    let subs: unknown[] = [COMP()];
    stubApi({
      'GET /v1/admin/users/u2': () => ({ body: detail(subs) }),
      'GET /v1/admin/plans': () => ({ body: PLANS }),
      'DELETE /v1/admin/users/u2/grants/c1': () => {
        subs = [{ ...COMP(), status: 'canceled' }];
        return { status: 204 };
      },
    });
    renderPage(<UserDetailPage id="u2" />);
    const panel = await screen.findByRole('region', { name: 'Subscription' });
    await u.click(within(panel).getByRole('button', { name: 'Revoke grant' }));
    const confirm = screen.getByRole('dialog', { name: 'Revoke the complimentary access?' });
    await u.click(within(confirm).getByRole('button', { name: 'Revoke grant' }));
    expect(await within(panel).findByText('No subscription.')).toBeVisible();
    await waitFor(() => {
      expect(
        within(panel).getByRole('button', { name: 'Grant complimentary access' }),
      ).toHaveFocus();
    });
  });

  it('Escape does nothing while a grant is pending', async () => {
    const u = userEvent.setup();
    stubApi({
      'GET /v1/admin/users/u2': () => ({ body: detail([]) }),
      'GET /v1/admin/plans': () => ({ body: PLANS }),
      'POST /v1/admin/users/u2/grants': () => new Promise(() => undefined),
    });
    renderPage(<UserDetailPage id="u2" />);
    await u.click(await screen.findByRole('button', { name: 'Grant complimentary access' }));
    const dialog = screen.getByRole('dialog', { name: 'Grant complimentary access' });
    await u.type(within(dialog).getByLabelText('Note'), 'x');
    await u.click(within(dialog).getByRole('button', { name: 'Grant' }));
    await u.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Grant complimentary access' })).toBeVisible();
    await u.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Grant complimentary access' })).toBeVisible();
  });

  it("the date input's min is today (UTC)", async () => {
    const u = userEvent.setup();
    stubApi({
      'GET /v1/admin/users/u2': () => ({ body: detail([]) }),
      'GET /v1/admin/plans': () => ({ body: PLANS }),
    });
    renderPage(<UserDetailPage id="u2" />);
    await u.click(await screen.findByRole('button', { name: 'Grant complimentary access' }));
    const dialog = screen.getByRole('dialog', { name: 'Grant complimentary access' });
    expect(within(dialog).getByLabelText('Until (optional)')).toHaveAttribute(
      'min',
      new Date().toISOString().slice(0, 10),
    );
  });

  it('with no grantable plan, Grant explains why', async () => {
    stubApi({
      'GET /v1/admin/users/u2': () => ({ body: detail([]) }),
      'GET /v1/admin/plans': () => ({ body: PLANS.filter((plan) => plan.archived) }),
    });
    renderPage(<UserDetailPage id="u2" />);
    const panel = await screen.findByRole('region', { name: 'Subscription' });
    const grant = within(panel).getByRole('button', { name: 'Grant complimentary access' });
    await waitFor(() => {
      expect(grant).toHaveAccessibleDescription(/every plan is archived/);
    });
    expect(grant).toBeDisabled();
  });

  it("plans that didn't load: Grant explains why", async () => {
    stubApi({
      'GET /v1/admin/users/u2': () => ({ body: detail([]) }),
      'GET /v1/admin/plans': () => ({
        status: 500,
        body: { error: { code: 'INTERNAL', message: 'm', requestId: 'r' } },
      }),
    });
    renderPage(<UserDetailPage id="u2" />);
    const panel = await screen.findByRole('region', { name: 'Subscription' });
    const grant = within(panel).getByRole('button', { name: 'Grant complimentary access' });
    await waitFor(() => {
      expect(grant).toHaveAccessibleDescription(/Plans couldn't be loaded/);
    });
  });

  it('a successful grant clears an old revoke error', async () => {
    const u = userEvent.setup();
    let subs: unknown[] = [COMP()];
    stubApi({
      'GET /v1/admin/users/u2': () => ({ body: detail(subs) }),
      'GET /v1/admin/plans': () => ({ body: PLANS }),
      'DELETE /v1/admin/users/u2/grants/c1': () => {
        subs = [];
        return conflict('notActive');
      },
      'POST /v1/admin/users/u2/grants': () => {
        subs = [COMP()];
        return { body: COMP() };
      },
    });
    renderPage(<UserDetailPage id="u2" />);
    const panel = await screen.findByRole('region', { name: 'Subscription' });
    await u.click(within(panel).getByRole('button', { name: 'Revoke grant' }));
    const confirm = screen.getByRole('dialog', { name: 'Revoke the complimentary access?' });
    await u.click(within(confirm).getByRole('button', { name: 'Revoke grant' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('already ended');
    await u.click(within(panel).getByRole('button', { name: 'Grant complimentary access' }));
    const dialog = screen.getByRole('dialog', { name: 'Grant complimentary access' });
    await u.type(within(dialog).getByLabelText('Note'), 'again');
    await u.click(within(dialog).getByRole('button', { name: 'Grant' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(within(panel).queryByRole('alert')).toBeNull();
  });
});
