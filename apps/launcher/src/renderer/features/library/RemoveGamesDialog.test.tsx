import { ok, type GameRow } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { LibraryApp } from './LibraryApp.tsx';
import { gameDetails, gameRow, libraryResponses, N64_SCOPE } from './testing.ts';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

function setup() {
  const games: GameRow[] = [
    gameRow(1, 'Alpha', { missing: true }),
    gameRow(2, 'Bravo', { missing: true }),
    gameRow(3, 'Charlie'),
  ];
  const calls: number[][] = [];
  installFakeBridge({
    ...libraryResponses(games),
    'library.games.get': ({ gameId }) =>
      ok(gameDetails(games.find((game) => game.id === gameId) ?? gameRow(gameId, 'X'))),
    'library.games.remove': ({ gameIds }) => {
      calls.push(gameIds);
      return ok({ removed: gameIds.length });
    },
  });
  renderInShell(<LibraryApp initialScope={N64_SCOPE} />);
  return { calls };
}

const openMenuOn = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
  await user.pointer({ keys: '[MouseRight]', target: await screen.findByRole('option', { name }) });
};

describe('remove from library (FR-LIB-14, US-C7)', () => {
  it('removes every selected missing game after a confirmation', async () => {
    const user = userEvent.setup();
    const { calls } = setup();
    await user.click(await screen.findByRole('option', { name: /Alpha/ }));
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    await openMenuOn(user, /Bravo/);
    await user.click(screen.getByRole('menuitem', { name: 'Remove from library…' }));

    const dialog = screen.getByRole('dialog', { name: 'Remove 2 games from the library?' });
    expect(within(dialog).getByText(/files on disk aren't touched/)).toBeVisible();
    expect(calls).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(calls).toEqual([[1, 2]]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names the game when one is removed, and Cancel removes nothing', async () => {
    const user = userEvent.setup();
    const { calls } = setup();
    await openMenuOn(user, /Alpha/);
    await user.click(screen.getByRole('menuitem', { name: 'Remove from library…' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove Alpha from the library?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(calls).toEqual([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is not offered when a selected game is present', async () => {
    const user = userEvent.setup();
    setup();
    await openMenuOn(user, /Charlie/);
    expect(screen.getByRole('menuitem', { name: 'Hide' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Remove from library…' })).toBeNull();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('option', { name: /Bravo/ }));
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    await openMenuOn(user, /Charlie/);
    expect(screen.queryByRole('menuitem', { name: 'Remove from library…' })).toBeNull();
  });
});
