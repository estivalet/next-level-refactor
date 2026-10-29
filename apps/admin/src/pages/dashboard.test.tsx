import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hrefOf, parseRoute } from '../router.ts';
import { renderPage, stubApi } from '../test-utils.tsx';
import { DashboardPage } from './DashboardPage.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

const days = (counts: Record<number, number> = {}) =>
  Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 8, 26 + i)).toISOString().slice(0, 10),
    count: counts[i] ?? 0,
  }));

const stats = (overrides: Record<string, unknown> = {}) => ({
  subscribers: { paying: 12, comp: 3 },
  mrr: [
    { currency: 'brl', amount: 23880 },
    { currency: 'usd', amount: 999 },
  ],
  downloads7d: 41,
  downloadsPerDay: days({ 0: 2, 29: 7 }),
  topItems: [{ itemId: 'i1', title: 'Star Hopper', downloads: 9 }],
  recentSignups: [{ id: 'u1', email: 'new@example.test', createdAt: '2026-10-25T09:00:00.000Z' }],
  pastDue: [{ userId: 'u2', email: 'late@example.test', periodEnd: '2026-10-22T00:00:00.000Z' }],
  ...overrides,
});

describe('Dashboard (S13, FR-ADM-6, D38, D49)', () => {
  it('the console opens on the dashboard; Users keeps its own route', () => {
    expect(parseRoute('')).toEqual({ page: 'dashboard' });
    expect(parseRoute('#/')).toEqual({ page: 'dashboard' });
    expect(parseRoute('#/nope')).toEqual({ page: 'dashboard' });
    expect(parseRoute('#/users')).toEqual({ page: 'users' });
    expect(hrefOf({ page: 'dashboard' })).toBe('#/');
  });

  it('tiles: subscribers (paying · comp), MRR per currency, downloads in 7 days', async () => {
    stubApi({ 'GET /v1/admin/stats': () => ({ body: stats() }) });
    renderPage(<DashboardPage />);
    const subscribers = await screen.findByRole('group', { name: 'Active subscribers' });
    expect(subscribers).toHaveTextContent('15');
    expect(subscribers).toHaveTextContent('12 paying · 3 complimentary');
    const mrr = screen.getByRole('group', { name: 'MRR' });
    expect(mrr).toHaveTextContent('R$');
    expect(mrr).toHaveTextContent('238.80');
    expect(mrr).toHaveTextContent('$9.99');
    expect(screen.getByRole('group', { name: 'Downloads, last 7 days' })).toHaveTextContent('41');
  });

  it('lists top items, the latest sign-ups and failed payments with links', async () => {
    stubApi({ 'GET /v1/admin/stats': () => ({ body: stats() }) });
    renderPage(<DashboardPage />);
    const top = await screen.findByRole('table', { name: 'Top items, last 30 days' });
    expect(within(top).getByRole('link', { name: 'Star Hopper' })).toHaveAttribute(
      'href',
      '#/catalog/i1/metadata',
    );
    expect(within(top).getByText('9')).toBeVisible();
    const signups = screen.getByRole('table', { name: 'Latest sign-ups' });
    expect(within(signups).getByRole('link', { name: 'new@example.test' })).toHaveAttribute(
      'href',
      '#/users/u1',
    );
    const failed = screen.getByRole('table', { name: 'Failed payments' });
    expect(within(failed).getByRole('link', { name: 'late@example.test' })).toHaveAttribute(
      'href',
      '#/users/u2',
    );
  });

  it('empty states: no MRR, no downloads, no items, nobody late', async () => {
    stubApi({
      'GET /v1/admin/stats': () => ({
        body: stats({
          subscribers: { paying: 0, comp: 0 },
          mrr: [],
          downloads7d: 0,
          downloadsPerDay: days(),
          topItems: [],
          recentSignups: [],
          pastDue: [],
        }),
      }),
    });
    renderPage(<DashboardPage />);
    expect(await screen.findByText('No paid subscriptions yet.')).toBeVisible();
    expect(screen.getByText('No downloads in the last 30 days.')).toBeVisible();
    expect(screen.getByText('No downloads yet.')).toBeVisible();
    expect(screen.getByText('No sign-ups yet.')).toBeVisible();
    expect(screen.getByText('No failed payments.')).toBeVisible();
    expect(screen.queryByRole('img', { name: /Downloads per day/ })).toBeNull();
  });

  it('the chart has an accessible table fallback with all 30 days', async () => {
    const u = userEvent.setup();
    stubApi({ 'GET /v1/admin/stats': () => ({ body: stats() }) });
    renderPage(<DashboardPage />);
    expect(
      await screen.findByRole('img', { name: 'Downloads per day, last 30 days' }),
    ).toBeVisible();
    await u.click(screen.getByText('Show as table'));
    const table = screen.getByRole('table', { name: 'Downloads per day' });
    expect(within(table).getAllByRole('row')).toHaveLength(31);
    expect(within(table).getByText('7')).toBeVisible();
  });

  it('hovering a day shows its date and count', async () => {
    stubApi({ 'GET /v1/admin/stats': () => ({ body: stats() }) });
    renderPage(<DashboardPage />);
    const chart = await screen.findByRole('img', { name: 'Downloads per day, last 30 days' });
    const targets = chart.querySelectorAll('[data-day]');
    expect(targets).toHaveLength(30);
    const last = targets[29];
    if (!last) throw new Error('no target');
    fireEvent.mouseEnter(last);
    expect(screen.getByRole('tooltip')).toHaveTextContent('7 downloads');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Oct 25');
    fireEvent.mouseLeave(last);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('a failed load is explained', async () => {
    stubApi({});
    renderPage(<DashboardPage />);
    expect(await screen.findByRole('alert')).toBeVisible();
  });
});
