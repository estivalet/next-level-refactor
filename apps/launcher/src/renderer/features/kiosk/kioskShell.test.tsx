import { defaultSettings, ok, type KioskState } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { Desktop } from '../shell/Desktop.tsx';
import { Taskbar } from '../shell/Taskbar.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const locked = (hide: KioskState['hide']): KioskState => ({
  enabled: true,
  locked: true,
  hide,
  retryAfterMs: 0,
});

describe('kiosk in the shell (FR-SET-6, US-D4)', () => {
  it('locked: hidden apps leave the desktop and Start menu; Quit goes; unlocking brings them back', async () => {
    const u = userEvent.setup();
    const bridge = installFakeBridge({
      'kiosk.state': () => ok(locked(['settings', 'catalog', 'account', 'quit'])),
      'downloads.list': () => ok([]),
    });
    renderInShell(<Desktop taskbar={<Taskbar />} />);
    const icons = within(await screen.findByRole('navigation', { name: 'Desktop apps' }));
    expect(await icons.findByRole('button', { name: 'Game Library' })).toBeVisible();
    expect(icons.queryByRole('button', { name: 'Settings' })).toBeNull();
    expect(icons.queryByRole('button', { name: 'Catalog' })).toBeNull();
    expect(icons.queryByRole('button', { name: 'Account' })).toBeNull();
    expect(icons.queryByRole('button', { name: 'Menu Editor' })).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.queryByRole('button', { name: 'Quit' })).toBeNull();
    bridge.emit('kiosk.changed', { ...locked(['settings']), locked: false });
    expect(await icons.findByRole('button', { name: 'Settings' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Quit' })).toBeVisible();
  });

  it('Lock now closes the open windows of hidden apps (Settings stays usable otherwise)', async () => {
    const u = userEvent.setup();
    const bridge = installFakeBridge({
      'kiosk.state': () => ok({ ...locked(['settings']), locked: false }),
      'downloads.list': () => ok([]),
    });
    renderInShell(<Desktop taskbar={<Taskbar />} />);
    const icons = within(await screen.findByRole('navigation', { name: 'Desktop apps' }));
    await u.dblClick(await icons.findByRole('button', { name: 'Settings' }));
    await u.dblClick(icons.getByRole('button', { name: 'Game Library' }));
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeVisible();
    bridge.emit('kiosk.changed', locked(['settings']));
    await vi.waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
    });
    expect(screen.getByRole('dialog', { name: 'Game Library' })).toBeVisible();
  });

  it('FR-SET-6: until kiosk.state loads, the saved kiosk settings decide what is hidden', async () => {
    const kioskOn = {
      ...defaultSettings(),
      kiosk: { enabled: true, pinHash: null, hide: ['settings' as const] },
    };
    installFakeBridge({
      'settings.get': () =>
        ok({ kind: 'ok' as const, snapshot: { settings: kioskOn, revision: 0 } }),
      // Never answers: the renderer has only the saved settings to go by.
      'kiosk.state': () => new Promise<never>(() => undefined),
      'downloads.list': () => ok([]),
    });
    renderInShell(<Desktop taskbar={<Taskbar />} />);
    const icons = within(await screen.findByRole('navigation', { name: 'Desktop apps' }));
    expect(await icons.findByRole('button', { name: 'Game Library' })).toBeVisible();
    expect(icons.queryByRole('button', { name: 'Settings' })).toBeNull();
  });

  it('FR-SET-6: with the kiosk off, nothing is hidden while kiosk.state loads', async () => {
    installFakeBridge({
      'kiosk.state': () => new Promise<never>(() => undefined),
      'downloads.list': () => ok([]),
    });
    renderInShell(<Desktop taskbar={<Taskbar />} />);
    const icons = within(await screen.findByRole('navigation', { name: 'Desktop apps' }));
    expect(await icons.findByRole('button', { name: 'Settings' })).toBeVisible();
  });
});
