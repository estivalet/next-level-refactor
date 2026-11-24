import { ok, type GameFlags, type GameRow } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { LibraryApp } from './LibraryApp.tsx';
import { gameRow, libraryResponses, N64_SCOPE, PICKS_SCOPE } from './testing.ts';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
  localStorage.clear();
});

const TABS = {
  all: 2,
  favorites: 0,
  recent: 0,
  completed: 0,
  hidden: 0,
  missing: 0,
  needsReview: 0,
  duplicates: 2,
  deleteLater: 1,
};

function setup(scope: typeof N64_SCOPE | typeof PICKS_SCOPE = N64_SCOPE) {
  const games: GameRow[] = [
    gameRow(1, 'Coca-Cola Kid', { relPath: '! Translated/Coca-Cola Kid [T-En by A].gg' }),
    gameRow(2, 'Coca-Cola Kid', {
      relPath: '! Translated/Coca-Cola Kid [T-En by B].gg',
      deleteLater: true,
    }),
  ];
  const flagCalls: Array<{ gameIds: number[]; flags: GameFlags }> = [];
  installFakeBridge({
    ...libraryResponses(games),
    'collections.list': () => ok([{ id: 1, name: 'Picks', sort: 'title', games: 2 }]),
    'library.games.facets': () => ok({ filters: [], genres: [], tabs: TABS, essentials: 0 }),
    'library.games.setFlags': (input) => {
      flagCalls.push(input);
      for (const id of input.gameIds) {
        const index = games.findIndex((game) => game.id === id);
        const game = games[index];
        if (game && input.flags.deleteLater !== undefined) {
          games[index] = { ...game, deleteLater: input.flags.deleteLater };
        }
      }
      return ok(undefined);
    },
  });
  renderInShell(<LibraryApp initialScope={scope} />);
  return { user: userEvent.setup(), flagCalls };
}

describe('library cleanup (FR-LIB-19, US-C13)', () => {
  it("FR-LIB-19: the list row shows the game's file under its title", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'List view' }));
    expect(await screen.findByText('! Translated\\Coca-Cola Kid [T-En by A].gg')).toBeVisible();
    expect(screen.getByLabelText('Marked Delete later')).toBeInTheDocument();
  });

  it('FR-LIB-19: the sidebar shows Duplicates and Delete later with counts in a system', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Duplicates' })).toHaveTextContent('Duplicates2');
    });
    expect(screen.getByRole('button', { name: 'Delete later' })).toHaveTextContent(
      'Delete later1',
    );
  });

  it('FR-LIB-19: no Duplicates entry in a collection', async () => {
    setup(PICKS_SCOPE);
    expect(await screen.findByRole('button', { name: 'Delete later' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Duplicates' })).toBeNull();
  });

  it('US-C13: Delete later toggles the mark from the details panel', async () => {
    const { user, flagCalls } = setup();
    const options = await screen.findAllByRole('option', { name: /Coca-Cola Kid/ });
    await user.click(options[0] as HTMLElement);
    const details = screen.getByRole('complementary', { name: 'Game details' });
    const toggle = await within(details).findByRole('button', { name: 'Delete later' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(flagCalls).toEqual([{ gameIds: [1], flags: { deleteLater: true } }]);
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('US-C13: the context menu marks a selection Delete later', async () => {
    const { user, flagCalls } = setup();
    const options = await screen.findAllByRole('option', { name: /Coca-Cola Kid/ });
    await user.pointer({ keys: '[MouseRight]', target: options[0] as HTMLElement });
    await user.click(await screen.findByRole('menuitem', { name: 'Mark Delete later' }));
    expect(flagCalls).toEqual([{ gameIds: [1], flags: { deleteLater: true } }]);
  });
});
