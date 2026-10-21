import { err, ok } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { LibraryApp } from './LibraryApp.tsx';
import { gameRow, IDLE, libraryResponses } from './testing.ts';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

describe('ScanMenu', () => {
  it('FR-LIB-3: Scan ▾ scans the current system and shows progress', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      ...libraryResponses([gameRow(1, 'Homebrew Demo')]),
      'scan.start': () => ok({ running: true, progress: null, last: null }),
      'scan.cancel': () => ok(IDLE),
    });
    renderInShell(<LibraryApp />);
    await user.click(await screen.findByRole('button', { name: 'Scan' }));
    await user.click(screen.getByRole('menuitem', { name: 'Scan Nintendo 64' }));
    expect(bridge.calls).toContainEqual({
      channel: 'scan.start',
      input: { systemIds: ['nintendo-64'] },
    });

    bridge.emit('scan.progress', {
      scanId: 's',
      systemsDone: 1,
      systemsTotal: 4,
      systemId: 'nintendo-64',
      filesSeen: 9,
    });
    expect(await screen.findByRole('button', { name: 'Scanning 1/4' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Scanning 1/4' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancel scan' }));
    expect(bridge.channels()).toContain('scan.cancel');
  });

  it('FR-LIB-3: a failed scan.start is shown', async () => {
    const user = userEvent.setup();
    installFakeBridge({
      ...libraryResponses([gameRow(1, 'Homebrew Demo')]),
      'scan.start': () => err('LIBRARY_UNAVAILABLE', 'errors.libraryUnavailable'),
    });
    renderInShell(<LibraryApp />);
    await user.click(await screen.findByRole('button', { name: 'Scan' }));
    await user.click(screen.getByRole('menuitem', { name: 'Scan all systems' }));
    expect(await screen.findByText('The game library could not be opened.')).toBeVisible();
  });
});
