import { ok } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { download } from '../catalog/catalogFixtures.ts';
import { Desktop } from './Desktop.tsx';
import { Taskbar } from './Taskbar.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const taskbar = () => within(screen.getByRole('navigation', { name: 'Taskbar' }));

describe('downloads in the tray (FR-SHELL-4, D47)', () => {
  it('hidden with no downloads', async () => {
    installFakeBridge({ 'downloads.list': () => ok([]) });
    renderInShell(<Desktop taskbar={<Taskbar />} />);
    await screen.findByRole('navigation', { name: 'Taskbar' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(taskbar().queryByRole('button', { name: /download/ })).toBeNull();
  });

  it('shows the count and overall %; a click opens Catalog → Downloads', async () => {
    const u = userEvent.setup();
    installFakeBridge({
      'downloads.list': () =>
        ok([
          download({ bytesDone: 1024, bytesTotal: 4096 }),
          download({ id: 'd2', itemId: 'i2', state: 'queued', bytesDone: 0, bytesTotal: 4096 }),
        ]),
      'catalog.list': () => ok({ items: [], nextCursor: null }),
      'catalog.installed': () => ok([]),
      'systems.catalog': () => ok([]),
      'launch.running': () => ok(null),
    });
    renderInShell(<Desktop taskbar={<Taskbar />} />);
    const tray = await taskbar().findByRole('button', { name: '2 downloads · 12%' });
    await u.click(tray);
    const catalog = await screen.findByRole('dialog', { name: 'Catalog' });
    expect(within(catalog).getByRole('tab', { name: 'Downloads' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
