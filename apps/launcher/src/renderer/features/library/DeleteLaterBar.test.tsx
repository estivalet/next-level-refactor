import { ok } from '@nextlevel/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { DeleteLaterBar } from './DeleteLaterBar.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const scope = { kind: 'system', systemId: 'gamegear' } as const;

describe('Delete later bar (FR-LIB-20, US-C14)', () => {
  it("US-C14: the bar exports the scope's cleanup script", async () => {
    const user = userEvent.setup();
    const { calls } = installFakeBridge({
      'library.exportCleanupScript': () => ok({ status: 'saved', games: 2, files: 3 }),
    });
    renderInShell(<DeleteLaterBar scope={scope} title="Sega Game Gear" count={2} />);

    expect(screen.getByText('2 games marked')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Export cleanup script…' }));

    expect(await screen.findByText(/Script saved: 2 games, 3 files/)).toBeInTheDocument();
    expect(calls).toContainEqual({
      channel: 'library.exportCleanupScript',
      input: { scope, title: 'Sega Game Gear' },
    });
  });

  it('US-C14: cancelling shows nothing', async () => {
    const user = userEvent.setup();
    const { calls } = installFakeBridge({
      'library.exportCleanupScript': () => ok({ status: 'cancelled' }),
    });
    renderInShell(<DeleteLaterBar scope={scope} title="GG" count={1} />);

    await user.click(screen.getByRole('button', { name: 'Export cleanup script…' }));

    expect(calls.some((call) => call.channel === 'library.exportCleanupScript')).toBe(true);
    expect(screen.queryByText(/Script saved/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Couldn't save/)).not.toBeInTheDocument();
  });

  it('US-C14: a failure says so', async () => {
    const user = userEvent.setup();
    installFakeBridge({});
    renderInShell(<DeleteLaterBar scope={scope} title="GG" count={1} />);

    await user.click(screen.getByRole('button', { name: 'Export cleanup script…' }));

    expect(await screen.findByText("Couldn't save the script.")).toBeInTheDocument();
  });
});
