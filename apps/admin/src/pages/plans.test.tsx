import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPage, stubApi } from '../test-utils.tsx';
import { useRoute } from '../router.ts';
import { Page } from './Page.tsx';
import { PlanEditor } from './PlanEditor.tsx';
import { PlansPage } from './PlansPage.tsx';
import { ScopesPage } from './ScopesPage.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = '';
});

const SCOPES = [
  { id: 's1', slug: 'demos', name: 'Demo scene', description: '' },
  { id: 's2', slug: 'homebrew-8bit', name: '8-bit homebrew', description: 'NES, SMS' },
];

const plan = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  slug: 'basic',
  name: 'Basic',
  deviceLimit: 2,
  scopeIds: ['s1'],
  stripePriceMonthly: 'price_m',
  stripePriceYearly: null,
  prices: { month: { amount: 1990, currency: 'brl' }, year: null },
  archived: false,
  subscribers: 4,
  ...overrides,
});

const conflict = (code: string, reason: string, status = 409) => ({
  status,
  body: { error: { code, message: 'm', requestId: 'r', details: { reason } } },
});

describe('Plans (S13, FR-ADM-2)', () => {
  it('lists plans with prices, devices, scopes, subscribers and an Archived badge', async () => {
    stubApi({
      'GET /v1/admin/plans': () => ({
        body: [
          plan(),
          plan({ id: 'p2', slug: 'old', name: 'Old', archived: true, subscribers: 0 }),
        ],
      }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
    });
    renderPage(<PlansPage />);
    await screen.findByRole('link', { name: 'Basic' });
    const table = screen.getByRole('table', { name: 'Plans' });
    const basic = within(table).getByRole('link', { name: 'Basic' }).closest('tr') as HTMLElement;
    expect(within(basic).getByText('basic')).toBeVisible();
    expect(within(basic).getByText(/19\.90/)).toBeVisible();
    expect(within(basic).getByText('Demo scene')).toBeVisible();
    expect(within(basic).getByText('4')).toBeVisible();
    const old = within(table).getByRole('link', { name: 'Old' }).closest('tr') as HTMLElement;
    expect(within(old).getByText('Archived')).toBeVisible();
    expect(screen.getByRole('link', { name: 'New plan' })).toHaveAttribute('href', '#/plans/new');
  });
});

describe('Plan editor (FR-ADM-2, US-F4)', () => {
  it('a new plan sends slug, name, devices, scopes and prices, then opens the saved plan', async () => {
    const u = userEvent.setup();
    const calls = stubApi({
      'GET /v1/admin/plans': () => ({ body: [] }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      'POST /v1/admin/plans': () => ({ body: plan({ id: 'p9' }) }),
    });
    renderPage(<PlanEditor id={null} />);
    const save = await screen.findByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await u.type(screen.getByLabelText('Slug'), 'basic');
    await u.type(screen.getByLabelText('Name'), 'Basic');
    await u.clear(screen.getByLabelText('Device limit'));
    await u.type(screen.getByLabelText('Device limit'), '2');
    await u.click(screen.getByLabelText('Demo scene'));
    await u.type(screen.getByLabelText('Monthly Stripe price id'), 'price_m');
    await u.click(save);
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      slug: 'basic',
      name: 'Basic',
      deviceLimit: 2,
      scopeIds: ['s1'],
      stripePriceMonthly: 'price_m',
      stripePriceYearly: null,
    });
    await vi.waitFor(() => {
      expect(window.location.hash).toBe('#/plans/p9');
    });
  });

  it('a created plan opens at once, even before (or without) the list refetch', async () => {
    const u = userEvent.setup();
    let created = false;
    stubApi({
      'GET /v1/admin/plans': () =>
        created
          ? { status: 500, body: { error: { code: 'INTERNAL', message: 'm', requestId: 'r' } } }
          : { body: [] },
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      'POST /v1/admin/plans': () => {
        created = true;
        return { body: plan({ id: 'p9' }) };
      },
    });
    window.location.hash = '#/plans/new';
    function Routed() {
      return <Page route={useRoute()} />;
    }
    renderPage(<Routed />);
    await u.type(await screen.findByLabelText('Slug'), 'basic');
    await u.type(screen.getByLabelText('Name'), 'Basic');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { name: 'Basic' })).toBeVisible();
    expect(screen.queryByText('This plan no longer exists.')).not.toBeInTheDocument();
  });

  it('an existing plan: slug read-only, stored amount shown, only changes are sent', async () => {
    const u = userEvent.setup();
    let current = plan();
    const calls = stubApi({
      'GET /v1/admin/plans': () => ({ body: [current] }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      'PATCH /v1/admin/plans/p1': () => {
        current = plan({ archived: true });
        return { body: current };
      },
    });
    renderPage(<PlanEditor id="p1" />);
    expect(await screen.findByLabelText('Slug')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Monthly Stripe price id')).toHaveAccessibleDescription(/19\.90/);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await u.click(screen.getByLabelText('Archived'));
    await u.click(save);
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ archived: true });
    expect(await screen.findByText('Saved.')).toBeVisible();
  });

  it.each([
    ['interval', 'Monthly Stripe price id', 'VALIDATION_FAILED', 400, /not a monthly/],
    ['inactive', 'Monthly Stripe price id', 'VALIDATION_FAILED', 400, /not active/],
    ['billingOff', 'Monthly Stripe price id', 'CONFLICT', 409, /No billing provider/],
    ['currency', 'Yearly Stripe price id', 'VALIDATION_FAILED', 400, /same currency/],
  ])('server reason %s is shown on the %s field', async (reason, field, code, status, text) => {
    const u = userEvent.setup();
    stubApi({
      'GET /v1/admin/plans': () => ({ body: [plan()] }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      'PATCH /v1/admin/plans/p1': () => conflict(code, reason, status),
    });
    renderPage(<PlanEditor id="p1" />);
    const input = await screen.findByLabelText(field);
    await u.clear(input);
    await u.type(input, 'price_new');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByLabelText(field)).toHaveAccessibleDescription(text);
  });

  it('slugTaken is shown on Slug; defaultPlan on Archived', async () => {
    const u = userEvent.setup();
    stubApi({
      'GET /v1/admin/plans': () => ({
        body: [plan({ id: 'pd', slug: 'default', name: 'Default' })],
      }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      'POST /v1/admin/plans': () => conflict('CONFLICT', 'slugTaken'),
      'PATCH /v1/admin/plans/pd': () => conflict('CONFLICT', 'defaultPlan'),
    });
    const view = renderPage(<PlanEditor id={null} />);
    await u.type(await screen.findByLabelText('Slug'), 'default');
    await u.type(screen.getByLabelText('Name'), 'Again');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByLabelText('Slug')).toHaveAccessibleDescription(/already used/);
    view.unmount();
    renderPage(<PlanEditor id="pd" />);
    await u.click(await screen.findByLabelText('Archived'));
    await u.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByLabelText('Archived')).toHaveAccessibleDescription(
      /Default plan can't be archived/,
    );
  });
});

describe('Catalog scopes (US-F4, D37)', () => {
  it('lists scopes, edits a name inline and adds a new one', async () => {
    const u = userEvent.setup();
    const calls = stubApi({
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      'PATCH /v1/admin/scopes/s1': () => ({ body: { ...SCOPES[0], name: 'Demos' } }),
      'POST /v1/admin/scopes': () => ({
        body: { id: 's3', slug: 'pd', name: 'Public domain', description: '' },
      }),
    });
    renderPage(<ScopesPage />);
    const row = await screen.findByRole('group', { name: 'demos' });
    const save = within(row).getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    const name = within(row).getByLabelText('Name');
    await u.clear(name);
    await u.type(name, 'Demos');
    await u.click(save);
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ name: 'Demos' });
    const add = screen.getByRole('group', { name: 'New scope' });
    await u.type(within(add).getByLabelText('Slug'), 'pd');
    await u.type(within(add).getByLabelText('Name'), 'Public domain');
    await u.click(within(add).getByRole('button', { name: 'Add scope' }));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      slug: 'pd',
      name: 'Public domain',
      description: '',
    });
  });

  it('a scope row keeps typed edits across a refetch that changes another row', async () => {
    const u = userEvent.setup();
    let saved = SCOPES;
    stubApi({
      'GET /v1/admin/scopes': () => ({ body: saved }),
      'PATCH /v1/admin/scopes/s1': () => {
        saved = SCOPES.map((scope) =>
          scope.id === 's1' ? { ...scope, name: 'Demos' } : { ...scope },
        );
        return { body: saved[0] };
      },
    });
    renderPage(<ScopesPage />);
    const other = await screen.findByRole('group', { name: 'homebrew-8bit' });
    await u.type(within(other).getByLabelText('Description'), ', SNES');
    const row = screen.getByRole('group', { name: 'demos' });
    await u.clear(within(row).getByLabelText('Name'));
    await u.type(within(row).getByLabelText('Name'), 'Demos');
    await u.click(within(row).getByRole('button', { name: 'Save' }));
    await screen.findByRole('status');
    expect(
      within(screen.getByRole('group', { name: 'homebrew-8bit' })).getByLabelText('Description'),
    ).toHaveValue('NES, SMS, SNES');
    expect(within(screen.getByRole('group', { name: 'demos' })).getByLabelText('Name')).toHaveValue(
      'Demos',
    );
  });

  it('a duplicate slug is explained', async () => {
    const u = userEvent.setup();
    stubApi({
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      'POST /v1/admin/scopes': () => conflict('CONFLICT', 'slugTaken'),
    });
    renderPage(<ScopesPage />);
    const add = await screen.findByRole('group', { name: 'New scope' });
    await u.type(within(add).getByLabelText('Slug'), 'demos');
    await u.type(within(add).getByLabelText('Name'), 'x');
    await u.click(within(add).getByRole('button', { name: 'Add scope' }));
    expect(await within(add).findByLabelText('Slug')).toHaveAccessibleDescription(/already used/);
  });
});

describe('plan editor polish (M8d minors)', () => {
  it('a price refusal shows under the price that was submitted, even after editing', async () => {
    const u = userEvent.setup();
    stubApi({
      'GET /v1/admin/plans': () => ({ body: [plan()] }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      'PATCH /v1/admin/plans/p1': () => conflict('VALIDATION_FAILED', 'inactive', 400),
    });
    renderPage(<PlanEditor id="p1" />);
    const monthly = await screen.findByLabelText('Monthly Stripe price id');
    await u.clear(monthly);
    await u.type(monthly, 'price_new');
    await u.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByLabelText('Monthly Stripe price id')).toHaveAccessibleDescription(
      /not active/,
    );
    await u.type(screen.getByLabelText('Yearly Stripe price id'), 'price_y');
    expect(screen.getByLabelText('Monthly Stripe price id')).toHaveAccessibleDescription(
      /not active/,
    );
    expect(screen.getByLabelText('Yearly Stripe price id')).not.toHaveAccessibleDescription(
      /not active/,
    );
  });

  it('a background refetch that changes subscribers keeps typed edits', async () => {
    const u = userEvent.setup();
    let current = plan();
    stubApi({
      'GET /v1/admin/plans': () => ({ body: [current] }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
    });
    const view = renderPage(<PlanEditor id="p1" />);
    const name = await screen.findByLabelText('Name');
    await u.clear(name);
    await u.type(name, 'Basic Plus');
    current = plan({ subscribers: 9 });
    await view.client.invalidateQueries();
    await waitFor(() => {
      expect(
        view.client.getQueryData<Array<{ subscribers: number }>>(['plans'])?.[0]?.subscribers,
      ).toBe(9);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByLabelText('Name')).toHaveValue('Basic Plus');
  });

  it('a disabled Save says why (empty name, device limit 1–20)', async () => {
    const u = userEvent.setup();
    stubApi({
      'GET /v1/admin/plans': () => ({ body: [plan()] }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
    });
    renderPage(<PlanEditor id="p1" />);
    const name = await screen.findByLabelText('Name');
    await u.clear(name);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(/Enter a name/);
    await u.type(name, 'Basic');
    const devices = screen.getByLabelText('Device limit');
    await u.clear(devices);
    await u.type(devices, '25');
    expect(save).toHaveAccessibleDescription(/1 to 20/);
  });

  it('a scope-row error shows under the field it names, and a saved scope shows Saved.', async () => {
    const u = userEvent.setup();
    let fail = true;
    let scopes = SCOPES;
    stubApi({
      'GET /v1/admin/scopes': () => ({ body: scopes }),
      'PATCH /v1/admin/scopes/s1': () =>
        fail
          ? {
              status: 400,
              body: {
                error: {
                  code: 'VALIDATION_FAILED',
                  message: 'm',
                  requestId: 'r',
                  details: { issues: [{ instancePath: '/name', message: 'too long' }] },
                },
              },
            }
          : (() => {
              scopes = SCOPES.map((scope) =>
                scope.id === 's1' ? { ...scope, name: 'Demos' } : scope,
              );
              return { body: scopes[0] };
            })(),
    });
    renderPage(<ScopesPage />);
    const row = await screen.findByRole('group', { name: 'demos' });
    const name = within(row).getByLabelText('Name');
    await u.clear(name);
    await u.type(name, 'Demos');
    await u.click(within(row).getByRole('button', { name: 'Save' }));
    expect(await within(row).findByLabelText('Name')).toHaveAccessibleDescription(/not valid/);
    expect(within(row).getByLabelText('Description')).not.toHaveAccessibleDescription(/not valid/);
    fail = false;
    await u.click(within(row).getByRole('button', { name: 'Save' }));
    const saved = await screen.findByRole('group', { name: 'demos' });
    expect(await within(saved).findByText('Saved.')).toBeVisible();
  });
});

describe('plan editor and other admins (review)', () => {
  it("another admin's change arrives in untouched fields and is never sent back", async () => {
    const u = userEvent.setup();
    let current = plan();
    const calls = stubApi({
      'GET /v1/admin/plans': () => ({ body: [current] }),
      'GET /v1/admin/scopes': () => ({ body: SCOPES }),
      'PATCH /v1/admin/plans/p1': () => ({ body: current }),
    });
    const view = renderPage(<PlanEditor id="p1" />);
    expect(await screen.findByLabelText('Name')).toHaveValue('Basic');
    current = plan({ name: 'Basic 2', stripePriceMonthly: 'price_b' });
    await view.client.invalidateQueries();
    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveValue('Basic 2');
    });
    expect(screen.getByLabelText('Monthly Stripe price id')).toHaveValue('price_b');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    const devices = screen.getByLabelText('Device limit');
    await u.clear(devices);
    await u.type(devices, '3');
    await u.click(save);
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ deviceLimit: 3 });
  });
});
