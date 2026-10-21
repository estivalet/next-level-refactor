import { ok, type GameListQuery } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { RelinkDialog } from './RelinkDialog.tsx';
import { gameDetails, gameRow } from './testing.ts';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

const LOST = gameDetails(
  gameRow(1, 'Game', { missing: true, expectedPath: 'E:\\roms\\Nintendo 64\\Game.z64' }),
);

describe('RelinkDialog', () => {
  it('FR-LIB-3: Relink picks a new game for a missing one', async () => {
    const user = userEvent.setup();
    const queries: GameListQuery[] = [];
    const relinks: unknown[] = [];
    installFakeBridge({
      'library.games.get': () => ok(LOST),
      'library.games.list': (query) => {
        queries.push(query);
        return ok({
          total: 2,
          offset: 0,
          games: [gameRow(1, 'Game', { missing: true }), gameRow(9, 'Game (USA)')],
        });
      },
      'library.games.relink': (input) => {
        relinks.push(input);
        return ok({ ...LOST, missing: false });
      },
    });
    let closed = false;
    renderInShell(
      <div className="relative">
        <RelinkDialog
          gameId={1}
          onClose={() => {
            closed = true;
          }}
        />
      </div>,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Relink Game' });
    expect(within(dialog).getByText('E:\\roms\\Nintendo 64\\Game.z64')).toBeVisible();
    await user.type(
      within(dialog).getByRole('searchbox', { name: "Search this system's games" }),
      'usa',
    );
    const candidates = await within(dialog).findByRole('listbox', {
      name: 'Games found in this system',
    });
    expect(
      within(candidates)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Game (USA)']);
    expect(queries.at(-1)).toMatchObject({
      scope: { kind: 'system', systemId: 'nintendo-64' },
      text: 'usa',
    });
    expect(within(dialog).getByRole('button', { name: 'Relink' })).toBeDisabled();
    await user.click(within(candidates).getByRole('option', { name: 'Game (USA)' }));
    expect(within(dialog).getByText(/takes the file of Game \(USA\)/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Relink' }));
    expect(relinks).toEqual([{ missingGameId: 1, replacementGameId: 9 }]);
    expect(closed).toBe(true);
  });
});
