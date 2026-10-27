import { err, ok } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { device, signedIn } from '../auth/testing.ts';
import { AccountApp } from './AccountApp.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

describe('Account app (S12, D24, FR-AUTH-6, FR-AUTH-8)', () => {
  it('shows the profile, the plan line and the devices; Revoke is not on this PC', async () => {
    const user = userEvent.setup();
    const fake = installFakeBridge({
      'auth.state': () => ok(signedIn()),
      'auth.devices.list': () => ok([device('d1', 'Den', true), device('d2', 'Office')]),
      'auth.devices.revoke': () => ok([device('d1', 'Den', true)]),
    });
    renderInShell(<AccountApp />);
    expect(await screen.findByText('player@example.test')).toBeVisible();
    expect(screen.getByText('Default plan — billing not enabled')).toBeVisible();
    const list = await screen.findByRole('list', { name: 'Devices' });
    const den = within(list).getByText('Den').closest('li') as HTMLElement;
    expect(within(den).getByText('This PC')).toBeVisible();
    expect(within(den).queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    const office = within(list).getByText('Office').closest('li') as HTMLElement;
    await user.click(within(office).getByRole('button', { name: 'Revoke' }));
    expect(fake.calls.find((c) => c.channel === 'auth.devices.revoke')?.input).toEqual({
      deviceId: 'd2',
    });
    expect(await screen.findByText('Den')).toBeVisible();
    expect(screen.queryByText('Office')).not.toBeInTheDocument();
  });

  it('Refresh checks now; Sign out signs out (FR-AUTH-6)', async () => {
    const user = userEvent.setup();
    const fake = installFakeBridge({
      'auth.state': () => ok(signedIn()),
      'auth.devices.list': () => ok([]),
      'auth.refreshEntitlement': () => ok(signedIn()),
      'auth.signOut': () => ok({ kind: 'signedOut', reason: null, banner: null }),
    });
    renderInShell(<AccountApp />);
    await user.click(await screen.findByRole('button', { name: 'Refresh' }));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(fake.channels()).toEqual(
      expect.arrayContaining(['auth.refreshEntitlement', 'auth.signOut']),
    );
  });

  it('says when the sign-in is not remembered, and when the device list is offline', async () => {
    installFakeBridge({
      'auth.state': () => ok(signedIn({ remembered: false, offline: true })),
      'auth.devices.list': () => err('API_UNREACHABLE', 'errors.apiUnreachable'),
    });
    renderInShell(<AccountApp />);
    expect(await screen.findByText(/sign in again next time/)).toBeVisible();
    expect(await screen.findByText(/Can't reach NextLevel/)).toBeVisible();
  });

  it('a revoke that fails says why under the list', async () => {
    const user = userEvent.setup();
    installFakeBridge({
      'auth.state': () => ok(signedIn()),
      'auth.devices.list': () => ok([device('d1', 'Den', true), device('d2', 'Office')]),
      'auth.devices.revoke': () => err('API_UNREACHABLE', 'errors.apiUnreachable'),
    });
    renderInShell(<AccountApp />);
    await user.click(await screen.findByRole('button', { name: 'Revoke' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Can't reach NextLevel/);
    expect(screen.getByText('Office')).toBeVisible();
  });

  it('D25: with sign-in off it says so', async () => {
    installFakeBridge({ 'auth.state': () => ok({ kind: 'disabled' }) });
    renderInShell(<AccountApp />);
    expect(
      await screen.findByText('Sign-in is turned off in this development build.'),
    ).toBeVisible();
  });

  it('security §3: no remote content — a Google avatar URL is not loaded', async () => {
    installFakeBridge({
      'auth.state': () =>
        ok({
          ...signedIn(),
          user: {
            id: 'u1',
            email: 'player@example.test',
            name: 'Player One',
            avatarUrl: 'https://lh3.googleusercontent.com/a/x',
            role: 'subscriber',
          },
        }),
      'auth.devices.list': () => ok([]),
    });
    renderInShell(<AccountApp />);
    await screen.findByText('player@example.test');
    expect(document.querySelector('img')).toBeNull();
  });
});
