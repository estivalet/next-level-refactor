import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPage, stubApi } from '../test-utils.tsx';
import { COMP, conflict, detail, PLANS } from './subscriptionFixtures.ts';
import { UserDetailPage } from './UserDetailPage.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveClass(
      'aria-disabled:opacity-50',
    );
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
