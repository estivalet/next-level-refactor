import { ok, type GameFlags, type GameRow } from '@nextlevel/shared';
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

/** A fake library whose setFlags changes the rows, as main would. */
function setup() {
  const games: GameRow[] = [gameRow(1, 'Alpha'), gameRow(2, 'Bravo'), gameRow(3, 'Charlie')];
  const flagCalls: Array<{ gameIds: number[]; flags: GameFlags }> = [];
  const bridge = installFakeBridge({
    ...libraryResponses(games),
    'library.games.setFlags': (input) => {
      flagCalls.push(input);
      for (const id of input.gameIds) {
        const index = games.findIndex((game) => game.id === id);
        const game = games[index];
        if (!game) continue;
        games[index] = {
          ...game,
          ...(input.flags.favorite === undefined ? {} : { favorite: input.flags.favorite }),
          ...(input.flags.hidden === undefined ? {} : { hidden: input.flags.hidden }),
          ...(input.flags.userRating === undefined ? {} : { userRating: input.flags.userRating }),
        };
      }
      return ok(undefined);
    },
  });
  renderInShell(<LibraryApp />);
  return { bridge, flagCalls };
}

const details = () => screen.getByRole('complementary', { name: 'Game details' });
const selectedTitles = () =>
  screen
    .getAllByRole('option')
    .filter((option) => option.getAttribute('aria-selected') === 'true')
    .map((option) => option.textContent);

describe('GameDetails', () => {
  it('FR-LIB-7: favoriting and rating from the details panel send setFlags', async () => {
    const user = userEvent.setup();
    const { flagCalls } = setup();
    await user.click(await screen.findByRole('option', { name: /Bravo/ }));
    expect(await within(details()).findByRole('heading', { name: 'Bravo' })).toBeVisible();

    await user.click(within(details()).getByRole('button', { name: 'Favorite' }));
    await user.click(within(details()).getByRole('radio', { name: '4 stars' }));
    await waitFor(() => {
      expect(within(details()).getByRole('radio', { name: '4 stars' })).toBeChecked();
    });
    await user.click(within(details()).getByRole('radio', { name: '4 stars' }));
    expect(flagCalls).toEqual([
      { gameIds: [2], flags: { favorite: true } },
      { gameIds: [2], flags: { userRating: 4 } },
      { gameIds: [2], flags: { userRating: null } },
    ]);
  });

  it('FR-LIB-7: hiding the selected game moves selection to the next row', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('option', { name: /Bravo/ }));
    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('option', { name: /Bravo/ }),
    });
    await user.click(
      within(screen.getByRole('menu', { name: 'Game actions' })).getByRole('menuitem', {
        name: 'Hide',
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: /Bravo/ })).not.toBeInTheDocument();
    });
    expect(selectedTitles()).toEqual(['Charlie']);
    expect(await within(details()).findByRole('heading', { name: 'Charlie' })).toBeVisible();
  });

  it('FR-LIB-7: bulk hide applies to every selected game', async () => {
    const user = userEvent.setup();
    const { flagCalls } = setup();
    await user.click(await screen.findByRole('option', { name: /Alpha/ }));
    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('option', { name: /Charlie/ }));
    await user.keyboard('{/Control}');
    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('option', { name: /Charlie/ }),
    });
    await user.click(screen.getByRole('menuitem', { name: 'Hide' }));
    expect(flagCalls).toEqual([{ gameIds: [1, 3], flags: { hidden: true } }]);
  });

  it('FR-LIB-6: Esc closes the context menu and returns focus to the list', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('option', { name: /Alpha/ }));
    await user.keyboard('{Shift>}{F10}{/Shift}');
    const menu = screen.getByRole('menu', { name: 'Game actions' });
    expect(within(menu).getByRole('menuitem', { name: 'Edit details…' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: 'Add to favorites' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Games' })).toHaveFocus();
  });

  it('FR-LIB-6: the focused game stays focused when a change re-sorts the list', async () => {
    const user = userEvent.setup();
    const games: GameRow[] = [gameRow(1, 'Alpha'), gameRow(2, 'Bravo'), gameRow(3, 'Charlie')];
    const bridge = installFakeBridge({
      ...libraryResponses(games),
      'library.games.list': (query) => {
        const rows = [...games].sort((a, b) => a.title.localeCompare(b.title));
        return ok({ total: rows.length, offset: query.offset, games: rows });
      },
    });
    renderInShell(<LibraryApp />);
    await user.click(await screen.findByRole('option', { name: /Charlie/ }));
    expect(await within(details()).findByRole('heading', { name: 'Charlie' })).toBeVisible();

    games[2] = gameRow(3, 'Aaron');
    bridge.emit('library.changed', { systems: ['nintendo-64'], gameIds: [3] });
    await screen.findByRole('option', { name: /Aaron/ });
    expect(selectedTitles()).toEqual(['Aaron']);
    expect(await within(details()).findByRole('heading', { name: 'Aaron' })).toBeVisible();
  });
});
