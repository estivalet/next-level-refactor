import { ok, type MetadataChanges } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { EditMetadataDialog } from './EditMetadataDialog.tsx';
import { gameDetails, gameRow } from './testing.ts';

afterEach(() => {
  setBridgeForTests(null);
});

function setup() {
  const sent: MetadataChanges[] = [];
  const game = gameDetails(gameRow(7, 'Racer', { year: 1999, genre: 'Racing' }), {
    developer: 'Homebrew Team',
    filters: ['homebrew'],
    lockedFields: ['genre'],
  });
  installFakeBridge({
    'library.games.get': () => ok(game),
    'library.games.updateMetadata': ({ changes }) => {
      sent.push(changes);
      return ok(game);
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
  return { sent, isClosed: () => closed };
}

describe('EditMetadataDialog', () => {
  it('FR-LIB-6: Edit details sends only changed fields', async () => {
    const user = userEvent.setup();
    const { sent, isClosed } = setup();
    const dialog = await screen.findByRole('dialog', { name: 'Edit details' });
    const title = await within(dialog).findByRole('textbox', { name: 'Title' });
    expect(title).toHaveValue('Racer');
    const save = within(dialog).getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await user.clear(title);
    await user.type(title, 'Racer Deluxe');
    const genre = within(dialog).getByRole('textbox', { name: /Genre/ });
    await user.clear(genre);
    await user.type(genre, 'Arcade');
    await user.type(within(dialog).getByRole('textbox', { name: 'Filters' }), ', hack');
    await user.click(save);
    expect(sent).toEqual([
      { title: 'Racer Deluxe', genre: 'Arcade', filters: ['homebrew', 'hack'] },
    ]);
    expect(isClosed()).toBe(true);
  });

  it('FR-LIB-6: an invalid year disables Save with the inline error', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await screen.findByRole('dialog', { name: 'Edit details' });
    const year = await within(dialog).findByRole('textbox', { name: 'Year' });
    await user.clear(year);
    await user.type(year, '19');
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(year).toHaveAccessibleDescription('Check this value.');
  });

  it('FR-LIB-6: locked fields say the user edited them', async () => {
    setup();
    const dialog = await screen.findByRole('dialog', { name: 'Edit details' });
    expect(
      await within(dialog).findByRole('textbox', { name: /Genre/ }),
    ).toHaveAccessibleDescription('Edited by you; a scrape keeps this value.');
  });
});
