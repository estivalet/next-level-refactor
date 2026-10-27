import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPage, stubApi, user } from '../test-utils.tsx';
import { AuditPage } from './AuditPage.tsx';
import { SettingsPage } from './SettingsPage.tsx';
import { UserDetailPage } from './UserDetailPage.tsx';
import { UsersPage } from './UsersPage.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const ENTITLEMENT = {
  userId: 'u2',
  role: 'subscriber',
  status: 'active',
  plan: { slug: 'default', name: 'Default', deviceLimit: 3 },
  scopes: [],
  checkedAt: '2026-10-25T12:00:00.000Z',
  offlineUntil: '2026-11-08T12:00:00.000Z',
};
const detail = (overrides: Record<string, unknown> = {}) => ({
  ...user('u2', 'player@example.test'),
  suspendedReason: null,
  entitlement: ENTITLEMENT,
  devices: [
    {
      id: 'd1',
      name: 'Den PC',
      platform: 'win32',
      appVersion: '0.7.0',
      createdAt: '2026-10-01T10:00:00.000Z',
      lastSeenAt: '2026-10-25T10:00:00.000Z',
      revokedAt: null,
      current: false,
    },
  ],
  audit: [],
  subscriptions: [],
  ...overrides,
});

describe('Users (S13, FR-ADM-1)', () => {
  it('lists users with their columns; search waits for typing to pause; Load more pages', async () => {
    const u = userEvent.setup();
    const calls = stubApi({
      'GET /v1/admin/users': () => ({
        body: { items: [user('u2', 'player@example.test')], nextCursor: 'c2' },
      }),
    });
    renderPage(<UsersPage />);
    const table = await screen.findByRole('table', { name: 'Users' });
    const row = (await within(table).findByText('player@example.test')).closest(
      'tr',
    ) as HTMLElement;
    expect(within(row).getByText('Subscriber')).toBeVisible();
    expect(within(row).getByText('Active')).toBeVisible();
    expect(within(row).getByRole('link', { name: 'player@example.test' })).toHaveAttribute(
      'href',
      '#/users/u2',
    );
    await u.type(screen.getByLabelText('Search email or name'), 'play');
    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('q=play'))).toBe(true);
    });
    expect(calls.some((c) => c.url.includes('q=p&') || c.url.endsWith('q=p'))).toBe(false);
    await u.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('cursor=c2'))).toBe(true);
    });
  });
});

describe('read errors (S13)', () => {
  it('a list that cannot be loaded says so instead of "no users"', async () => {
    stubApi({
      'GET /v1/admin/users': () => ({
        status: 500,
        body: { error: { code: 'INTERNAL', message: 'm', requestId: 'r' } },
      }),
    });
    renderPage(<UsersPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.queryByText('No users found.')).not.toBeInTheDocument();
  });
});

describe('User detail (S13, US-F3, FR-AUTH-7)', () => {
  it('US-F3: Suspend needs a reason and sends it; the status updates', async () => {
    const u = userEvent.setup();
    let current = detail();
    const calls = stubApi({
      'GET /v1/admin/users/u2': () => ({ body: current }),
      'PATCH /v1/admin/users/u2': ({ body }) => {
        current = detail({
          status: 'suspended',
          suspendedReason: (body as { suspendedReason: string }).suspendedReason,
        });
        return { body: current };
      },
    });
    renderPage(<UserDetailPage id="u2" />);
    await u.click(await screen.findByRole('button', { name: 'Suspend' }));
    const dialog = screen.getByRole('dialog', { name: 'Suspend player@example.test' });
    expect(within(dialog).getByRole('button', { name: 'Suspend' })).toBeDisabled();
    await u.type(within(dialog).getByLabelText('Reason'), 'Account sharing');
    await u.click(within(dialog).getByRole('button', { name: 'Suspend' }));
    expect(await screen.findByText('Suspended: Account sharing')).toBeVisible();
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
      status: 'suspended',
      suspendedReason: 'Account sharing',
    });
  });

  it('the last-admin refusal is explained', async () => {
    const u = userEvent.setup();
    stubApi({
      'GET /v1/admin/users/u2': () => ({ body: detail({ role: 'admin' }) }),
      'PATCH /v1/admin/users/u2': () => ({
        status: 409,
        body: {
          error: {
            code: 'CONFLICT',
            message: 'm',
            requestId: 'r',
            details: { reason: 'lastAdmin' },
          },
        },
      }),
    });
    renderPage(<UserDetailPage id="u2" />);
    await u.selectOptions(await screen.findByLabelText('Role'), 'subscriber');
    expect(await screen.findByRole('alert')).toHaveTextContent("You can't remove the last admin.");
  });

  it('Revoke asks first, then signs the device out', async () => {
    const u = userEvent.setup();
    const calls = stubApi({
      'GET /v1/admin/users/u2': () => ({ body: detail() }),
      'DELETE /v1/admin/users/u2/devices/d1': () => ({ status: 204 }),
    });
    renderPage(<UserDetailPage id="u2" />);
    await u.click(await screen.findByRole('button', { name: 'Revoke' }));
    const dialog = screen.getByRole('dialog', { name: 'Sign Den PC out?' });
    await u.click(within(dialog).getByRole('button', { name: 'Revoke' }));
    await waitFor(() => {
      expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
    });
  });
});

describe('Audit log (S13, FR-ADM-5)', () => {
  it('shows who did what to whom, with only the changed keys', async () => {
    stubApi({
      'GET /v1/admin/audit': () => ({
        body: {
          items: [
            {
              id: 'a1',
              actor: { id: 'u1', email: 'admin@example.test' },
              action: 'settings.update',
              targetType: 'settings',
              targetId: 'app',
              before: { graceDays: 14, banner: null },
              after: { graceDays: 7, banner: null },
              at: '2026-10-25T12:00:00.000Z',
            },
          ],
          nextCursor: null,
        },
      }),
    });
    renderPage(<AuditPage />);
    const row = (await screen.findByText('Settings changed')).closest('tr') as HTMLElement;
    expect(within(row).getByText('admin@example.test')).toBeVisible();
    expect(within(row).getByText('graceDays: 14 → 7')).toBeVisible();
    expect(within(row).queryByText(/banner/)).not.toBeInTheDocument();
  });
});

describe('Settings (S13, FR-ADM-4)', () => {
  const SETTINGS = {
    graceDays: 14,
    signUpMode: 'allowList',
    allowList: ['a@x.test'],
    banner: null,
  };

  it('Save is off until something changes; bad emails are named; the patch carries the change', async () => {
    const u = userEvent.setup();
    const calls = stubApi({
      'GET /v1/admin/settings': () => ({ body: SETTINGS }),
      'PATCH /v1/admin/settings': ({ body }) => ({ body: { ...SETTINGS, ...(body as object) } }),
    });
    renderPage(<SettingsPage />);
    const save = await screen.findByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    const list = screen.getByLabelText('Allow-list (one email per line)');
    await u.type(list, '{enter}nope');
    expect(screen.getByRole('alert')).toHaveTextContent('Not an email: nope');
    expect(save).toBeDisabled();
    await u.clear(list);
    await u.type(list, 'a@x.test{enter}b@x.test');
    const grace = screen.getByLabelText('Offline grace (days)');
    await u.clear(grace);
    await u.type(grace, '7');
    await u.click(screen.getByLabelText('Existing accounts only'));
    await u.type(screen.getByLabelText('Maintenance banner'), 'Back at 22:00');
    expect(screen.getByText('13/280')).toBeVisible();
    await u.click(save);
    expect(await screen.findByText('Saved.')).toBeVisible();
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
      graceDays: 7,
      signUpMode: 'closed',
      allowList: ['a@x.test', 'b@x.test'],
      banner: 'Back at 22:00',
    });
  });

  it('NFR-A11Y-1: fields point at their help and error text', async () => {
    const u = userEvent.setup();
    stubApi({ 'GET /v1/admin/settings': () => ({ body: SETTINGS }) });
    renderPage(<SettingsPage />);
    const grace = await screen.findByLabelText('Offline grace (days)');
    expect(grace).toHaveAccessibleDescription(/1–30/);
    const list = screen.getByLabelText('Allow-list (one email per line)');
    expect(list).not.toHaveAttribute('aria-describedby');
    await u.type(list, '{enter}nope');
    expect(list).toHaveAttribute('aria-invalid', 'true');
    expect(list).toHaveAccessibleDescription('Not an email: nope');
  });

  it('FR-ADM-4: an email that only differs in case or repeats is not a change', async () => {
    const u = userEvent.setup();
    stubApi({ 'GET /v1/admin/settings': () => ({ body: SETTINGS }) });
    renderPage(<SettingsPage />);
    const list = await screen.findByLabelText('Allow-list (one email per line)');
    await u.clear(list);
    await u.type(list, 'A@X.test{enter}a@x.test');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
