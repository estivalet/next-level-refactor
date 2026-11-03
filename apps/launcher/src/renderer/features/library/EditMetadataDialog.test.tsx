import { ok, type MetadataChanges } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { EditMetadataDialog, type EditPager } from './EditMetadataDialog.tsx';
import { gameDetails, gameRow } from './testing.ts';

afterEach(() => {
  setBridgeForTests(null);
});

function setup(options: { media?: Record<string, number>; pager?: EditPager } = {}) {
  const sent: MetadataChanges[] = [];
  const game = gameDetails(gameRow(7, 'Racer', { year: 1999, genre: 'Racing' }), {
    developer: 'Homebrew Team',
    filters: ['homebrew'],
    lockedFields: ['genre'],
    media: options.media ?? {},
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
        {...(options.pager ? { pager: options.pager } : {})}
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

  it('Media tab: every standard art kind is a tile; found ones show the indexed file', async () => {
    const user = userEvent.setup();
    setup({ media: { 'box-front': 3, 'logo-clear': 1, manual: 2 } });
    const dialog = await screen.findByRole('dialog', { name: 'Edit details' });
    await user.click(within(dialog).getByRole('tab', { name: 'Media' }));
    // 10 standard kinds + the extra indexed `manual`; 3 of them have a file.
    expect(within(dialog).getByText('3 of 11 found')).toBeInTheDocument();
    const tiles = within(dialog).getAllByRole('listitem');
    expect(tiles).toHaveLength(11);
    expect(within(dialog).getByRole('img', { name: 'Box front' })).toHaveAttribute(
      'src',
      'nextlevel://media/7/box-front?v=3',
    );
    expect(within(dialog).getByRole('img', { name: 'manual' })).toBeInTheDocument();
    const marquee = tiles.find((tile) => within(tile).queryByText('Marquee'));
    expect(marquee && within(marquee).getByText('Not found')).toBeInTheDocument();
  });

  it('Media tab: Show found only hides the missing kinds', async () => {
    const user = userEvent.setup();
    setup({ media: { 'box-front': 3 } });
    const dialog = await screen.findByRole('dialog', { name: 'Edit details' });
    await user.click(within(dialog).getByRole('tab', { name: 'Media' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Show found only' }));
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1);
    expect(within(dialog).queryByText('Not found')).not.toBeInTheDocument();
  });

  it('Media tab: a found tile opens full size; Esc closes the view, not the dialog', async () => {
    const user = userEvent.setup();
    const { isClosed } = setup({ media: { 'box-front': 3 } });
    const dialog = await screen.findByRole('dialog', { name: 'Edit details' });
    await user.click(within(dialog).getByRole('tab', { name: 'Media' }));
    await user.click(within(dialog).getByRole('button', { name: 'View Box front' }));
    const view = screen.getByRole('dialog', { name: 'Box front' });
    expect(within(view).getByRole('img', { name: 'Box front' })).toHaveAttribute(
      'src',
      'nextlevel://media/7/box-front?v=3',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Box front' })).not.toBeInTheDocument();
    expect(isClosed()).toBe(false);
  });

  it('pager: steps through the list; off at the ends and while there are unsaved changes', async () => {
    const user = userEvent.setup();
    const steps: number[] = [];
    setup({ pager: { position: 1, total: 3, onStep: (delta) => steps.push(delta) } });
    const dialog = await screen.findByRole('dialog', { name: 'Edit details' });
    expect(within(dialog).getByText('1 / 3')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Previous game' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Next game' }));
    expect(steps).toEqual([1]);
    await user.type(await within(dialog).findByRole('textbox', { name: 'Title' }), ' II');
    expect(within(dialog).getByRole('button', { name: 'Next game' })).toBeDisabled();
  });
});
