import { ok } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { CatalogApp } from './CatalogApp.tsx';
import { download } from './catalogFixtures.ts';

afterEach(() => {
  setBridgeForTests(null);
});

describe('Catalog app: Downloads (FR-CAT-4, D47)', () => {
  it('lists the queue with progress and why each waits; pause, retry and cancel go to main', async () => {
    const u = userEvent.setup();
    const bridge = installFakeBridge({
      'systems.catalog': () => ok([]),
      'catalog.list': () => ok({ items: [], nextCursor: null }),
      'catalog.installed': () => ok([]),
      'launch.running': () => ok(null),
      'downloads.list': () =>
        ok([
          download(),
          download({
            id: 'd2',
            itemId: 'i2',
            title: 'Moss Garden',
            state: 'paused',
            pausedReason: 'network',
          }),
          download({
            id: 'd3',
            itemId: 'i3',
            title: 'Orbit Drift',
            state: 'failed',
            error: 'diskFull',
          }),
        ]),
      'downloads.pause': () => ok(undefined),
      'downloads.resume': () => ok(undefined),
      'downloads.cancel': () => ok(undefined),
    });
    renderInShell(<CatalogApp params={{ tab: 'downloads' }} />);
    const list = await screen.findByRole('list', { name: 'Downloads' });
    const [first, second, third] = await within(list).findAllByRole('listitem');
    expect(
      within(first as HTMLElement).getByRole('progressbar', { name: 'Download of Star Hopper' }),
    ).toHaveAttribute('value', '4096');
    expect(first).toHaveTextContent('Downloading 50%');
    expect(second).toHaveTextContent('Waiting for the network');
    expect(third).toHaveTextContent('Not enough disk space');
    await u.click(within(first as HTMLElement).getByRole('button', { name: 'Pause' }));
    await u.click(within(third as HTMLElement).getByRole('button', { name: 'Retry' }));
    await u.click(
      within(second as HTMLElement).getByRole('button', { name: 'Cancel Moss Garden' }),
    );
    await waitFor(() => {
      expect(
        bridge.calls
          .filter((c) => c.channel.startsWith('downloads.') && c.channel !== 'downloads.list')
          .map((c) => [c.channel, c.input]),
      ).toEqual([
        ['downloads.pause', { downloadId: 'd1' }],
        ['downloads.resume', { downloadId: 'd3' }],
        ['downloads.cancel', { downloadId: 'd2' }],
      ]);
    });
  });
});
