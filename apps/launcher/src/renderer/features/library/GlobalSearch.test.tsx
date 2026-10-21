import { ok } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { LibraryApp } from './LibraryApp.tsx';
import { gameRow, libraryResponses } from './testing.ts';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

describe('GlobalSearch', () => {
  it('FR-LIB-10: typing in global search shows results from all systems with system names', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      ...libraryResponses([gameRow(1, 'Homebrew Demo')]),
      'library.search': ({ text }) =>
        ok({
          games: [
            gameRow(7, `Zelda Quest (${text})`, { systemId: 'snes' }),
            gameRow(8, 'The Zelda Demo'),
          ],
          more: false,
        }),
    });
    renderInShell(<LibraryApp />);
    const box = await screen.findByRole('searchbox', { name: 'Search all games' });
    await user.type(box, 'z');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(bridge.channels()).not.toContain('library.search');

    await user.type(box, 'el');
    const results = await screen.findByRole('listbox', { name: 'Search results' });
    const rows = await within(results).findAllByRole('option');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Zelda Quest (zel)Super Nintendo',
      'The Zelda DemoNintendo 64',
    ]);
    const searches = bridge.calls.filter((call) => call.channel === 'library.search');
    expect(searches).toEqual([{ channel: 'library.search', input: { text: 'zel', limit: 200 } }]);

    await user.click(rows[0] as HTMLElement);
    const details = screen.getByRole('complementary', { name: 'Game details' });
    expect(await within(details).findByRole('heading', { name: 'Unknown' })).toBeVisible();

    await user.click(box);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('listbox', { name: 'Search results' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('listbox', { name: 'Games' })).toBeVisible();
  });
});
