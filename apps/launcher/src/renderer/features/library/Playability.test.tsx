import {
  ok,
  type GameRow,
  type MetadataChanges,
  type Playability,
  type PlayabilityChange,
} from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { EditMetadataDialog } from './EditMetadataDialog.tsx';
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

const MARK: Playability = {
  mark: 'issues',
  note: 'Sound crackles',
  at: '2026-03-21T15:49:31.000Z',
};

function setup() {
  const games: GameRow[] = [gameRow(1, 'Alpha'), gameRow(2, 'Bravo')];
  const calls: Array<{ gameIds: number[]; change: PlayabilityChange }> = [];
  installFakeBridge({
    ...libraryResponses(games),
    'library.games.get': ({ gameId }) => {
      const row = games.find((game) => game.id === gameId) ?? gameRow(gameId, 'X');
      return ok(gameDetails(row, { playability: gameId === 2 ? MARK : null }));
    },
    'library.games.setPlayability': (input) => {
      calls.push(input);
      return ok(undefined);
    },
  });
  renderInShell(<LibraryApp initialScope={N64_SCOPE} />);
  return { calls };
}

const details = () => screen.getByRole('complementary', { name: 'Game details' });

describe('playability (FR-LIB-13)', () => {
  it('the details show the mark, its note and date, and set or clear it', async () => {
    const user = userEvent.setup();
    const { calls } = setup();
    await user.click(await screen.findByRole('option', { name: /Bravo/ }));
    const group = await within(details()).findByRole('group', { name: 'Playability' });
    expect(within(group).getByRole('button', { name: 'Minor issues' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(details()).getByText('Sound crackles')).toBeVisible();
    expect(within(details()).getByText(/Set on/)).toBeVisible();

    await user.click(within(group).getByRole('button', { name: 'Broken' }));
    expect(calls).toContainEqual({ gameIds: [2], change: { mark: 'broken' } });
    await user.click(within(group).getByRole('button', { name: 'Minor issues' }));
    expect(calls).toContainEqual({ gameIds: [2], change: { mark: null } });
  });

  it('the context menu marks every selected game', async () => {
    const user = userEvent.setup();
    const { calls } = setup();
    await user.click(await screen.findByRole('option', { name: /Alpha/ }));
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('option', { name: /Bravo/ }),
    });
    await user.click(screen.getByRole('menuitem', { name: 'Playability…' }));
    await user.click(screen.getByRole('menuitem', { name: 'Works' }));
    expect(calls).toEqual([{ gameIds: [1, 2], change: { mark: 'works' } }]);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('the context menu can clear the mark, and Back returns to the menu', async () => {
    const user = userEvent.setup();
    const { calls } = setup();
    await user.pointer({
      keys: '[MouseRight]',
      target: await screen.findByRole('option', { name: /Alpha/ }),
    });
    await user.click(screen.getByRole('menuitem', { name: 'Playability…' }));
    await user.click(screen.getByRole('menuitem', { name: 'Back' }));
    await user.click(screen.getByRole('menuitem', { name: 'Playability…' }));
    await user.click(screen.getByRole('menuitem', { name: 'Clear playability' }));
    expect(calls).toEqual([{ gameIds: [1], change: { mark: null } }]);
  });

  it('Edit details sets the mark and note without touching the other fields', async () => {
    const user = userEvent.setup();
    const sent: MetadataChanges[] = [];
    const calls: Array<{ gameIds: number[]; change: PlayabilityChange }> = [];
    installFakeBridge({
      'library.games.get': () => ok(gameDetails(gameRow(7, 'Racer'), { playability: MARK })),
      'library.games.updateMetadata': ({ changes }) => {
        sent.push(changes);
        return ok(gameDetails(gameRow(7, 'Racer')));
      },
      'library.games.setPlayability': (input) => {
        calls.push(input);
        return ok(undefined);
      },
    });
    let closed = false;
    renderInShell(
      <div className="relative">
        <EditMetadataDialog
          gameId={7}
          onClose={() => {
            closed = true;
          }}
        />
      </div>,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit details' });
    const note = within(dialog).getByRole('textbox', { name: 'Playability note' });
    expect(note).toHaveValue('Sound crackles');
    const save = within(dialog).getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    const group = within(dialog).getByRole('group', { name: 'Playability' });
    await user.click(within(group).getByRole('button', { name: 'Works' }));
    await user.clear(note);
    await user.type(note, 'Fine with 7.1');
    await user.click(save);
    expect(calls).toEqual([{ gameIds: [7], change: { mark: 'works', note: 'Fine with 7.1' } }]);
    expect(sent).toEqual([]);
    expect(closed).toBe(true);
  });
});
