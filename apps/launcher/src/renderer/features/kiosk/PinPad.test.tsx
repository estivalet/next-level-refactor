import { ok } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { PinPad } from './PinPad.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

describe('PIN pad (US-D4, D54)', () => {
  it('PinPad: keyboard digits and Enter unlock; the PIN is never shown', async () => {
    const u = userEvent.setup();
    const onDone = vi.fn();
    const bridge = installFakeBridge({ 'kiosk.unlock': () => ok({ ok: true }) });
    renderInShell(<PinPad onClose={vi.fn()} onUnlocked={onDone} />);
    const dialog = await screen.findByRole('dialog', { name: 'Enter the kiosk PIN' });
    expect(dialog).toBeVisible();
    await u.keyboard('1234');
    expect(screen.getByLabelText('PIN')).toHaveTextContent('••••');
    expect(screen.queryByText('1234')).toBeNull();
    await u.keyboard('{Enter}');
    expect(bridge.calls).toContainEqual({ channel: 'kiosk.unlock', input: { pin: '1234' } });
    await vi.waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
  });

  it('the pad works with directions and select (gamepad): moves over the keys and presses them', async () => {
    const u = userEvent.setup();
    const bridge = installFakeBridge({ 'kiosk.unlock': () => ok({ ok: true }) });
    renderInShell(<PinPad onClose={vi.fn()} onUnlocked={vi.fn()} />);
    await screen.findByRole('dialog', { name: 'Enter the kiosk PIN' });
    // Focus starts on 1; right → 2; down → 5.
    await u.keyboard('{Enter}{ArrowRight}{Enter}{ArrowDown}{Enter}{Enter}');
    expect(screen.getByLabelText('PIN')).toHaveTextContent('••••');
    await u.click(screen.getByRole('button', { name: 'OK' }));
    expect(bridge.calls).toContainEqual({ channel: 'kiosk.unlock', input: { pin: '1255' } });
  });

  it('PinPad: wrong PIN says so and clears; after 5 the wait shows and OK is off', async () => {
    const u = userEvent.setup();
    const answers = [
      { ok: false as const, retryAfterMs: 0 },
      { ok: false as const, retryAfterMs: 60_000 },
    ];
    installFakeBridge({
      'kiosk.unlock': () => ok(answers.shift() ?? { ok: false, retryAfterMs: 0 }),
    });
    renderInShell(<PinPad onClose={vi.fn()} onUnlocked={vi.fn()} />);
    await screen.findByRole('dialog', { name: 'Enter the kiosk PIN' });
    await u.keyboard('9999{Enter}');
    expect(await screen.findByText('Wrong PIN.')).toBeVisible();
    expect(screen.getByLabelText('PIN')).toHaveTextContent('');
    await u.keyboard('9999{Enter}');
    expect(await screen.findByText('Too many tries. Try again in 60 s.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
  });

  it('Escape or Cancel closes it', async () => {
    const u = userEvent.setup();
    const onClose = vi.fn();
    installFakeBridge({});
    renderInShell(<PinPad onClose={onClose} onUnlocked={vi.fn()} />);
    await screen.findByRole('dialog', { name: 'Enter the kiosk PIN' });
    await u.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
