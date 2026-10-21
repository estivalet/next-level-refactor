import { err } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell, type FakeResponses } from '../../test-utils.tsx';
import { SettingsApp } from './SettingsApp.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

async function openAbout(responses: FakeResponses = {}) {
  const user = userEvent.setup();
  installFakeBridge(responses);
  renderInShell(<SettingsApp />);
  await user.click(screen.getByRole('button', { name: 'About' }));
}

describe('SettingsApp', () => {
  it('IA §1: opens on General, with every section in the navigation', () => {
    installFakeBridge();
    renderInShell(<SettingsApp />);
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    for (const name of ['General', 'Storage', 'Systems', 'Backups', 'Data & logs', 'About']) {
      expect(within(nav).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'General', current: 'page' })).toBeInTheDocument();
  });

  it('IA §1 Settings > About: shows the version from the bridge', async () => {
    await openAbout();
    expect(screen.getByRole('button', { name: 'About', current: 'page' })).toBeInTheDocument();
    expect(await screen.findByText('Version 0.0.0')).toBeInTheDocument();
  });

  it('shows "Version unavailable" when invoke resolves an error', async () => {
    await openAbout({ 'app.version': () => err('INTERNAL', 'errors.internal') });
    expect(await screen.findByText('Version unavailable')).toBeInTheDocument();
  });

  it('shows "Version unavailable" when invoke rejects', async () => {
    await openAbout({ 'app.version': () => Promise.reject(new Error('ipc down')) });
    expect(await screen.findByText('Version unavailable')).toBeInTheDocument();
  });
});
