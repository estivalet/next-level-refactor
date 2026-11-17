import type { SystemInfoSummary } from '@nextlevel/shared';
import { fireEvent, screen, within } from '@testing-library/react';
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

    first.unmount();
    renderInShell(<MuseumHome systems={[make('genesis', 'Mega Drive')]} onOpen={onOpen} />);
    expect(screen.queryByRole('region', { name: 'Recently changed' })).toBeNull();
  });

  it('FR-MUS-9: Home opens on a welcome banner with the museum picture, not on a system', () => {
    renderInShell(<MuseumHome systems={[make('snes', 'Super Nintendo')]} onOpen={vi.fn()} />);
    const welcome = screen.getByTestId('museum-welcome');
    expect(
      within(welcome).getByRole('heading', { name: 'Welcome to the Museum' }),
    ).toBeInTheDocument();
    expect(welcome.querySelector('img')).toHaveAttribute(
      'src',
      'nextlevel://art/assets/system-info/museum.jpg',
    );
    expect(screen.queryByTestId('system-hero')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open entry' })).toBeNull();
  });

  it('FR-MUS-9: without the museum picture the welcome banner keeps its text', () => {
    renderInShell(<MuseumHome systems={[]} onOpen={vi.fn()} />);
    const welcome = screen.getByTestId('museum-welcome');
    const img = welcome.querySelector('img');
    expect(img).not.toBeNull();
    fireEvent.error(img as HTMLImageElement);
    expect(welcome.querySelector('img')).toBeNull();
    expect(
      within(welcome).getByRole('heading', { name: 'Welcome to the Museum' }),
    ).toBeInTheDocument();
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
