import { defaultSettings, ok } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { BackupsSection } from './BackupsSection.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const BACKUP = {
  id: 'settings-2026-10-21T12-00-01-000Z.json',
  createdAt: '2026-10-21T12:00:01.000Z',
  size: 2048,
  changes: ['general.language'],
};

describe('BackupsSection', () => {
  it('US-D3: lists backups with what changed; Restore asks to confirm, then restores', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'settings.backups.list': () => ok([BACKUP]),
      'settings.backups.restore': () => ok({ settings: defaultSettings(), revision: 2 }),
    });
    renderInShell(<BackupsSection />);

    const row = (await screen.findByText('Language')).closest('tr');
    if (!row) throw new Error('no row');
    expect(within(row).getByText('2 KB')).toBeVisible();

    await user.click(within(row).getByRole('button', { name: 'Restore' }));
    expect(screen.getByText(/Your current settings are backed up first/)).toBeVisible();
    expect(bridge.channels()).not.toContain('settings.backups.restore');

    await user.click(screen.getByRole('button', { name: 'Confirm restore' }));
    expect(bridge.calls).toContainEqual({
      channel: 'settings.backups.restore',
      input: { id: BACKUP.id },
    });
    expect(await screen.findByText('Backup restored.')).toBeVisible();
  });

  it('US-D3: Cancel leaves the settings alone', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({ 'settings.backups.list': () => ok([BACKUP]) });
    renderInShell(<BackupsSection />);
    await user.click(await screen.findByRole('button', { name: 'Restore' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Confirm restore' })).not.toBeInTheDocument();
    expect(bridge.channels()).not.toContain('settings.backups.restore');
  });

  it('FR-SET-3: shows the empty state with no backups', async () => {
    installFakeBridge();
    renderInShell(<BackupsSection />);
    expect(await screen.findByText(/No backups yet/)).toBeVisible();
  });

  it('FR-SET-4: Export and Import call their channels; a cancelled import changes nothing', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'settings.export': () => ok({ status: 'saved' as const }),
      'settings.import': () => ok({ status: 'cancelled' as const }),
    });
    renderInShell(<BackupsSection />);
    await user.click(await screen.findByRole('button', { name: 'Export…' }));
    expect(await screen.findByText('Settings exported.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Import…' }));
    expect(bridge.channels()).toEqual(
      expect.arrayContaining(['settings.export', 'settings.import']),
    );
    expect(screen.queryByText('Settings imported.')).not.toBeInTheDocument();
  });
});
