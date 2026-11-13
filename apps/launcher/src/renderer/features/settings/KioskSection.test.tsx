import { ok, type KioskState } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { KioskSection } from './KioskSection.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const ALL = ['desktop', 'settings', 'themeSwitcher', 'catalog', 'account', 'quit'] as const;
const off: KioskState = { enabled: false, locked: false, hide: [...ALL], retryAfterMs: 0 };

describe('Settings → Kiosk (FR-SET-6, US-D4, D54)', () => {
  it('KioskPage: enabling needs the PIN twice; hide checkboxes save', async () => {
    const u = userEvent.setup();
    const bridge = installFakeBridge({
      'kiosk.state': () => ok(off),
      'kiosk.configure': (input) => ok({ ...off, enabled: input.enabled, hide: input.hide }),
    });
    renderInShell(<KioskSection />);
    await u.click(await screen.findByRole('switch', { name: 'Kiosk mode' }));
    const save = screen.getByRole('button', { name: 'Save' });
    await u.type(screen.getByLabelText('New PIN'), '4821');
    await u.type(screen.getByLabelText('PIN again'), '4820');
    expect(screen.getByText("The PINs don't match.")).toBeVisible();
    expect(save).toBeDisabled();
    await u.clear(screen.getByLabelText('PIN again'));
    await u.type(screen.getByLabelText('PIN again'), '4821');
    expect(screen.getByRole('checkbox', { name: 'Settings' })).toBeChecked();
    await u.click(screen.getByRole('checkbox', { name: 'Quit' }));
    await u.click(save);
    const call = bridge.calls.find((c) => c.channel === 'kiosk.configure');
    expect(call?.input).toEqual({
      enabled: true,
      pin: '4821',
      hide: ['desktop', 'settings', 'themeSwitcher', 'catalog', 'account'],
    });
  });

  it('a PIN of 3 digits or letters is refused', async () => {
    const u = userEvent.setup();
    installFakeBridge({ 'kiosk.state': () => ok(off) });
    renderInShell(<KioskSection />);
    await u.click(await screen.findByRole('switch', { name: 'Kiosk mode' }));
    await u.type(screen.getByLabelText('New PIN'), '12a');
    expect(screen.getByLabelText('New PIN')).toHaveValue('12');
    await u.type(screen.getByLabelText('PIN again'), '12');
    expect(screen.getByText('Use 4 to 8 digits.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('kiosk on: Lock now locks; changing what it hides keeps the PIN (no PIN fields needed)', async () => {
    const u = userEvent.setup();
    const on: KioskState = { ...off, enabled: true };
    const bridge = installFakeBridge({
      'kiosk.state': () => ok(on),
      'kiosk.lock': () => ok({ ...on, locked: true }),
      'kiosk.configure': (input) => ok({ ...on, hide: input.hide }),
    });
    renderInShell(<KioskSection />);
    await u.click(await screen.findByRole('checkbox', { name: 'Catalog' }));
    await u.click(screen.getByRole('button', { name: 'Save' }));
    expect(bridge.calls.find((c) => c.channel === 'kiosk.configure')?.input).toEqual({
      enabled: true,
      hide: ['desktop', 'settings', 'themeSwitcher', 'account', 'quit'],
    });
    await u.click(screen.getByRole('button', { name: 'Lock now' }));
    expect(bridge.channels()).toContain('kiosk.lock');
  });
});
