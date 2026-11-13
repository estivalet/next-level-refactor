import { ok, type KioskState } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
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
});
