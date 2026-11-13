import { ok } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { Desktop } from './Desktop.tsx';
import { Taskbar } from './Taskbar.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const taskbar = () => within(screen.getByRole('navigation', { name: 'Taskbar' }));

describe('update in the tray (NFR-UPD-1, D53)', () => {
  it('hidden until an update is downloaded; then Restart to update installs it', async () => {
    const u = userEvent.setup();
    const bridge = installFakeBridge({
      'update.state': () => ok({ kind: 'idle', lastCheck: null }),
      'update.restart': () => ok(undefined),
      'downloads.list': () => ok([]),
    });
    renderInShell(<Desktop taskbar={<Taskbar />} />);
    await screen.findByRole('navigation', { name: 'Taskbar' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(taskbar().queryByRole('button', { name: /update/i })).toBeNull();
    bridge.emit('update.changed', { kind: 'ready', version: '1.0.1' });
    await u.click(await taskbar().findByRole('button', { name: 'Restart to update to 1.0.1' }));
    expect(bridge.channels()).toContain('update.restart');
  });
});
