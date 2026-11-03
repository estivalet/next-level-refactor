import { ok, type LaunchBoxStatus } from '@nextlevel/shared';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { LaunchBoxPanel } from './LaunchBoxPanel.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const status = (patch: Partial<LaunchBoxStatus>): LaunchBoxStatus => ({
  state: 'missing',
  builtAt: null,
  games: 0,
  progress: null,
  error: null,
  ...patch,
});

describe('Settings → Scraper → LaunchBox (FR-SCR-6)', () => {
  it('downloads, shows progress with Cancel, then the date and game count with Refresh', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      'launchbox.status': () => ok(status({})),
      'launchbox.refresh': () => ok(status({ state: 'downloading', progress: 0 })),
      'launchbox.cancel': () => ok(status({})),
    });
    renderInShell(<LaunchBoxPanel />);
    expect(await screen.findByText('Not downloaded')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download (about 110 MB)' }));
    expect(bridge.calls.some((call) => call.channel === 'launchbox.refresh')).toBe(true);
    expect(await screen.findByRole('progressbar', { name: 'Downloading' })).toBeInTheDocument();
    act(() => {
      bridge.emit('launchbox.changed', status({ state: 'building', progress: 0.4 }));
    });
    expect(await screen.findByRole('progressbar', { name: 'Building the index' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    act(() => {
      bridge.emit(
        'launchbox.changed',
        status({ state: 'ready', builtAt: '2026-11-02T08:00:00.000Z', games: 190224 }),
      );
    });
    expect(await screen.findByText(/^Updated .+ · 190,224 games$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('a failure shows its message; a previous index still shows its date', async () => {
    installFakeBridge({
      'launchbox.status': () =>
        ok(
          status({
            state: 'failed',
            builtAt: '2026-11-01T08:00:00.000Z',
            games: 3,
            error: 'errors.launchboxDownload',
          }),
        ),
    });
    renderInShell(<LaunchBoxPanel />);
    expect(
      await screen.findByText(
        'The LaunchBox database could not be downloaded. Check the connection and try again.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Updated .+ · 3 games$/)).toBeInTheDocument();
  });
});
