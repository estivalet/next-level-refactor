import { ok, type SyncState } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { SyncSection } from './SyncSection.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const off: SyncState = { enabled: false, lastSync: null, syncing: false, error: null };
const on: SyncState = { ...off, enabled: true, lastSync: '2026-11-13T12:00:00.000Z' };

describe('Settings → Sync (FR-SET-5, D55)', () => {
  it('off by default; turning it on calls sync.setEnabled and shows the last sync', async () => {
    const u = userEvent.setup();
    const bridge = installFakeBridge({
      'sync.state': () => ok(off),
      'sync.setEnabled': ({ enabled }) => ok(enabled ? on : off),
    });
    renderInShell(<SyncSection />);
    const toggle = await screen.findByRole('switch', { name: 'Sync with my account' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Never synced on this PC.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled();
    await u.click(toggle);
    expect(bridge.calls.find((c) => c.channel === 'sync.setEnabled')?.input).toEqual({
      enabled: true,
    });
    expect(await screen.findByText(/^Last synced /)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeEnabled();
  });

  it('shows why the last sync failed', async () => {
    installFakeBridge({ 'sync.state': () => ok({ ...on, error: 'deletedElsewhere' }) });
    renderInShell(<SyncSection />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/deleted on another PC/i);
  });

  it('Delete synced data asks first; Cancel deletes nothing', async () => {
    const u = userEvent.setup();
    const bridge = installFakeBridge({
      'sync.state': () => ok(on),
      'sync.deleteRemote': () => ok(off),
    });
    renderInShell(<SyncSection />);
    await u.click(await screen.findByRole('button', { name: 'Delete synced data' }));
    await u.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(bridge.calls.some((c) => c.channel === 'sync.deleteRemote')).toBe(false);
    await u.click(screen.getByRole('button', { name: 'Delete synced data' }));
    await u.click(screen.getByRole('button', { name: 'Delete from my account' }));
    expect(bridge.calls.some((c) => c.channel === 'sync.deleteRemote')).toBe(true);
    expect(await screen.findByRole('switch', { name: 'Sync with my account' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});
