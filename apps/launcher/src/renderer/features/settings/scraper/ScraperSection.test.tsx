import { defaultSettings, err, ok, type CredentialStatus } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { ScraperSection } from './ScraperSection.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const status = (patch: Partial<CredentialStatus> = {}): CredentialStatus => ({
  available: true,
  devId: true,
  devPassword: true,
  user: false,
  password: false,
  ...patch,
});

describe('ScraperSection (FR-SCR-3, US-D6)', () => {
  it('US-D6: saving the account stores it and never shows the password again', async () => {
    const user = userEvent.setup();
    let stored = status();
    const bridge = installFakeBridge({
      'scraper.credentials.status': () => ok(stored),
      'scraper.credentials.set': (input) => {
        stored = status({ user: input.user != null, password: input.password != null });
        return ok(stored);
      },
    });
    renderInShell(<ScraperSection />);
    const password = await screen.findByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await user.type(screen.getByLabelText('User name'), 'player1');
    await user.type(password, 'hunter2');
    await user.click(screen.getByRole('button', { name: 'Save credentials' }));

    expect(bridge.calls).toContainEqual({
      channel: 'scraper.credentials.set',
      input: { user: 'player1', password: 'hunter2' },
    });
    expect(await screen.findByText('Credentials saved.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveAttribute('placeholder', 'Saved');
    expect(document.body.textContent).not.toContain('hunter2');
  });

  it('Save credentials stays off until something is typed', async () => {
    installFakeBridge({ 'scraper.credentials.status': () => ok(status()) });
    renderInShell(<ScraperSection />);
    expect(await screen.findByRole('button', { name: 'Save credentials' })).toBeDisabled();
  });

  it('developer credentials are collapsed and marked Required when missing', async () => {
    const user = userEvent.setup();
    installFakeBridge({
      'scraper.credentials.status': () => ok(status({ devId: false, devPassword: false })),
    });
    renderInShell(<ScraperSection />);
    const summary = await screen.findByText('Developer credentials');
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByLabelText('Developer password')).not.toBeVisible();
    await user.click(summary);
    expect(screen.getByLabelText('Developer password')).toBeVisible();
    expect(screen.getByLabelText('Developer password')).toHaveAttribute('type', 'password');
  });

  it('without the OS credential store, saving is off and says why', async () => {
    const user = userEvent.setup();
    installFakeBridge({ 'scraper.credentials.status': () => ok(status({ available: false })) });
    renderInShell(<ScraperSection />);
    expect(
      await screen.findByText('Windows could not encrypt the credentials, so they were not saved.'),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('User name'), 'x');
    expect(screen.getByRole('button', { name: 'Save credentials' })).toBeDisabled();
  });

  it('Test shows the account and quota, or the translated error', async () => {
    const user = userEvent.setup();
    let fail = false;
    installFakeBridge({
      'scraper.credentials.status': () => ok(status({ user: true, password: true })),
      'scraper.test': () =>
        fail
          ? err('SCRAPER_CREDENTIALS', 'errors.scraperCredentials')
          : ok({ user: 'player1', requestsToday: 12, maxRequestsPerDay: 20000 }),
    });
    renderInShell(<ScraperSection />);
    await user.click(await screen.findByRole('button', { name: 'Test' }));
    expect(
      await screen.findByText('Signed in as player1 · 12 of 20000 requests today'),
    ).toBeInTheDocument();
    fail = true;
    await user.click(screen.getByRole('button', { name: 'Test' }));
    expect(
      await screen.findByText(
        'ScreenScraper rejected the credentials. Check them in Settings → Scraper.',
      ),
    ).toBeInTheDocument();
  });

  it('Remove asks first, then clears every credential', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'scraper.credentials.status': () => ok(status({ user: true, password: true })),
      'scraper.credentials.set': () =>
        ok(status({ devId: false, devPassword: false, user: false, password: false })),
    });
    renderInShell(<ScraperSection />);
    await user.click(await screen.findByRole('button', { name: 'Remove credentials' }));
    expect(bridge.channels()).not.toContain('scraper.credentials.set');
    const confirm = screen.getByRole('alertdialog');
    expect(
      within(confirm).getByText('Remove all ScreenScraper credentials from this PC?'),
    ).toBeVisible();
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }));
    expect(bridge.calls).toContainEqual({
      channel: 'scraper.credentials.set',
      input: { devId: null, devPassword: null, user: null, password: null },
    });
    expect(await screen.findByText('Credentials removed.')).toBeInTheDocument();
  });

  it('FR-SCR-2: region order, art kinds and fields save through settings', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'scraper.credentials.status': () => ok(status()),
      'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
    });
    renderInShell(<ScraperSection />);
    await user.click(await screen.findByRole('button', { name: 'Move eu up' }));
    await user.click(screen.getByRole('checkbox', { name: 'Video' }));
    await user.click(screen.getByRole('checkbox', { name: 'Rating' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const settings = defaultSettings();
    expect(bridge.calls).toContainEqual({
      channel: 'settings.save',
      input: {
        settings: {
          ...settings,
          scraper: {
            ...settings.scraper,
            regionPriority: ['eu', 'us', 'wor', 'jp'],
            artKinds: [...settings.scraper.artKinds, 'video'],
            fields: settings.scraper.fields.filter((field) => field !== 'rating'),
          },
        },
        baseRevision: 0,
      },
    });
  });

  it('no title among the batch fields (D19); Save is off with no region', async () => {
    const user = userEvent.setup();
    installFakeBridge({ 'scraper.credentials.status': () => ok(status()) });
    renderInShell(<ScraperSection />);
    await screen.findByRole('checkbox', { name: 'Description' });
    expect(screen.queryByRole('checkbox', { name: 'Title' })).not.toBeInTheDocument();
    for (const region of ['us', 'eu', 'wor', 'jp']) {
      await user.click(screen.getByRole('button', { name: `Remove ${region}` }));
    }
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
