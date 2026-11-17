import type { SystemInfoSummary } from '@nextlevel/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderInShell } from '../../test-utils.tsx';
import { MuseumHome } from './MuseumHome.tsx';

const make = (
  systemId: string,
  name: string,
  extra: Partial<SystemInfoSummary> = {},
): SystemInfoSummary => ({
  systemId,
  name,
  kind: 'console',
  manufacturer: null,
  releaseYear: null,
  edited: false,
  hasNotes: false,
  changedAt: null,
  ...extra,
});

describe('MuseumHome', () => {
  it('FR-MUS-9: Home hides empty rows and opens a system from a card', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    const systems = [
      make('snes', 'Super Nintendo', {
        manufacturer: 'Nintendo',
        releaseYear: 1990,
        changedAt: '2026-02-01T00:00:00.000Z',
      }),
      make('genesis', 'Mega Drive'),
    ];
    const first = renderInShell(<MuseumHome systems={systems} onOpen={onOpen} />);
    const recent = screen.getByRole('region', { name: 'Recently changed' });
    expect(screen.queryByRole('region', { name: 'With your notes' })).toBeNull();
    await user.click(within(recent).getByRole('button', { name: /Super Nintendo/ }));
    expect(onOpen).toHaveBeenCalledWith('snes');

    await user.click(screen.getByRole('button', { name: 'Open entry' }));
    expect(onOpen).toHaveBeenLastCalledWith('snes');

    first.unmount();
    renderInShell(<MuseumHome systems={[make('genesis', 'Mega Drive')]} onOpen={onOpen} />);
    expect(screen.queryByRole('region', { name: 'Recently changed' })).toBeNull();
    expect(screen.getByTestId('system-hero')).toHaveTextContent('Mega Drive');
  });

  it('FR-MUS-9: counts show systems, edited and with-notes totals', () => {
    const systems = [
      make('a', 'A', { edited: true, hasNotes: true }),
      make('b', 'B', { edited: true }),
      make('c', 'C'),
    ];
    renderInShell(<MuseumHome systems={systems} onOpen={vi.fn()} />);
    expect(screen.getByTestId('museum-counts')).toHaveTextContent(
      '3 systems · 2 edited · 1 with notes',
    );
    const notes = screen.getByRole('region', { name: 'With your notes' });
    expect(within(notes).getAllByRole('button')).toHaveLength(1);
  });
});
