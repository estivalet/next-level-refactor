import { ok, type UpdateState } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { AboutSection } from './AboutSection.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const idle: UpdateState = { kind: 'idle', lastCheck: null };

describe('Settings → About (NFR-UPD-1, D53)', () => {
  it('About shows version, channel switch, Check now; ready → Restart to update', async () => {
    const u = userEvent.setup();
    const bridge = installFakeBridge({
      'app.version': () => ok('0.10.0'),
      'update.state': () => ok(idle),
      'update.check': () => ok({ kind: 'checking' }),
      'update.restart': () => ok(undefined),
    });
    renderInShell(<AboutSection />);
    expect(await screen.findByText('Version 0.10.0')).toBeVisible();
    expect(await screen.findByRole('combobox', { name: 'Update channel' })).toHaveValue('stable');
    expect(screen.getByRole('switch', { name: 'Check for updates automatically' })).toBeChecked();
    expect(screen.getByText('Not checked yet.')).toBeVisible();
    await u.click(screen.getByRole('button', { name: 'Check now' }));
    expect(bridge.channels()).toContain('update.check');
    expect(await screen.findByText('Checking for updates…')).toBeVisible();
    bridge.emit('update.changed', { kind: 'downloading', version: '1.0.1', percent: 40 });
    expect(await screen.findByText('Downloading 1.0.1… 40%')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Check now' })).toBeDisabled();
    bridge.emit('update.changed', { kind: 'ready', version: '1.0.1' });
    await u.click(await screen.findByRole('button', { name: 'Restart to update' }));
    expect(bridge.channels()).toContain('update.restart');
  });

  it('the channel and automatic checks are saved in settings.updates', async () => {
    const u = userEvent.setup();
    const bridge = installFakeBridge({
      'update.state': () => ok(idle),
      'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
    });
    renderInShell(<AboutSection />);
    await u.selectOptions(await screen.findByRole('combobox', { name: 'Update channel' }), 'beta');
    await u.click(screen.getByRole('switch', { name: 'Check for updates automatically' }));
    await u.click(screen.getByRole('button', { name: 'Save' }));
    const save = bridge.calls.find((call) => call.channel === 'settings.save');
    expect(save?.input).toMatchObject({ settings: { updates: { channel: 'beta', auto: false } } });
  });

  it('a zip copy says it cannot update itself, names a newer version and opens its page', async () => {
    const u = userEvent.setup();
    const bridge = installFakeBridge({
      'update.state': () =>
        ok({
          kind: 'unsupported',
          reason: 'zip',
          availableVersion: '1.0.1',
          releaseUrl: 'https://github.com/estivalet/next-level-refactor/releases/tag/v1.0.1',
        }),
      'update.openRelease': () => ok(undefined),
    });
    renderInShell(<AboutSection />);
    expect(
      await screen.findByText(/This copy was unzipped, so it can't update itself/),
    ).toBeVisible();
    expect(screen.getByText('Version 1.0.1 is available.')).toBeVisible();
    await u.click(screen.getByRole('button', { name: 'Open the download page' }));
    expect(bridge.channels()).toContain('update.openRelease');
  });

  it('an error says what went wrong and Check now tries again', async () => {
    installFakeBridge({ 'update.state': () => ok({ kind: 'error', code: 'network' }) });
    renderInShell(<AboutSection />);
    expect(await screen.findByText("Couldn't reach the update server.")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Check now' })).toBeEnabled();
  });

  it('development builds have no Check now', async () => {
    installFakeBridge({
      'update.state': () =>
        ok({ kind: 'unsupported', reason: 'dev', availableVersion: null, releaseUrl: null }),
    });
    renderInShell(<AboutSection />);
    expect(await screen.findByText('Development builds don’t update.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Check now' })).toBeNull();
  });
});
