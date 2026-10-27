import { ok, type AuthState } from '@nextlevel/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { createQueryClient } from '../../queryClient.ts';
import { installFakeBridge } from '../../test-utils.tsx';
import { AuthGate } from './AuthGate.tsx';
import { device, signedIn } from './testing.ts';

afterEach(() => {
  setBridgeForTests(null);
});

function setup(state: AuthState, extra: Parameters<typeof installFakeBridge>[0] = {}) {
  const fake = installFakeBridge({
    'auth.state': () => ok(state),
    'auth.signIn': () => ok({ kind: 'signingIn' }),
    'auth.cancelSignIn': () => ok(state),
    'auth.signOut': () => ok({ kind: 'signedOut', reason: null, banner: null }),
    'auth.resolveDeviceLimit': () => ok(signedIn()),
    ...extra,
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthGate>
        <p>the launcher</p>
      </AuthGate>
    </QueryClientProvider>,
  );
  return fake;
}

const SIGNED_OUT = (
  reason: Extract<AuthState, { kind: 'signedOut' }>['reason'],
  banner: string | null = null,
): AuthState => ({
  kind: 'signedOut',
  reason,
  banner,
});

describe('sign-in gate (IA §1, S2, US-A1..A3)', () => {
  it('D25: disabled and signed-in active users reach the launcher', async () => {
    setup({ kind: 'disabled' });
    expect(await screen.findByText('the launcher')).toBeVisible();
  });

  it('US-A1: signed out shows Sign in with Google, focused; clicking it starts the sign-in', async () => {
    const user = userEvent.setup();
    const fake = setup(SIGNED_OUT(null));
    const button = await screen.findByRole('button', { name: 'Sign in with Google' });
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(fake.channels()).toContain('auth.signIn');
    expect(screen.queryByText('the launcher')).not.toBeInTheDocument();
  });

  it('US-A1: waiting for the browser shows Cancel', async () => {
    const user = userEvent.setup();
    const fake = setup({ kind: 'signingIn' });
    expect(await screen.findByText('Waiting for your browser…')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(fake.channels()).toContain('auth.cancelSignIn');
  });

  it.each([
    ['cancelled', 'Sign-in was cancelled.'],
    ['offlineExpired', 'Connect to the internet to continue.'],
    ['notAllowed', "This Google account isn't authorized."],
    ['unreachable', "Can't reach NextLevel. Check your connection and try again."],
    ['revoked', 'This PC was signed out. Sign in again.'],
  ] as const)('signed out (%s) explains why and offers a retry', async (reason, text) => {
    setup(SIGNED_OUT(reason));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  it('D28: the maintenance banner shows on the sign-in screen', async () => {
    setup(SIGNED_OUT(null, 'Maintenance tonight at 22:00'));
    expect(await screen.findByText('Maintenance tonight at 22:00')).toBeVisible();
  });

  it('FR-AUTH-7: a suspended account sees the notice and Sign out, no launcher', async () => {
    const user = userEvent.setup();
    const fake = setup(signedIn({}, { status: 'suspended', plan: null }));
    expect(await screen.findByRole('heading', { name: 'This account is suspended' })).toBeVisible();
    expect(screen.queryByText('the launcher')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(fake.channels()).toContain('auth.signOut');
  });

  it('FR-AUTH-3, D21: no entitlement shows the Subscribe placeholder with Sign out', async () => {
    setup(signedIn({}, { status: 'none', plan: null }));
    expect(
      await screen.findByRole('heading', { name: "Subscriptions aren't open yet" }),
    ).toBeVisible();
    expect(screen.getByText(/player@example\.test/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  it('US-A4: device limit lists the devices; Remove and continue resolves it', async () => {
    const user = userEvent.setup();
    const fake = setup({
      kind: 'deviceLimit',
      devices: [device('d1', 'Den'), device('d2', 'Office'), device('d3', 'Laptop')],
    });
    expect(await screen.findByText('Office')).toBeVisible();
    const buttons = screen.getAllByRole('button', { name: 'Remove and continue' });
    expect(buttons).toHaveLength(3);
    // Keyboard and gamepad users start on the first choice.
    expect(buttons[0]).toHaveFocus();
    await user.click(buttons[1] as HTMLElement);
    expect(fake.calls.find((c) => c.channel === 'auth.resolveDeviceLimit')?.input).toEqual({
      revokeDeviceId: 'd2',
    });
  });

  it('auth.changed moves the gate without a reload', async () => {
    const fake = setup(SIGNED_OUT(null));
    await screen.findByRole('button', { name: 'Sign in with Google' });
    fake.emit('auth.changed', signedIn());
    expect(await screen.findByText('the launcher')).toBeVisible();
  });
});
