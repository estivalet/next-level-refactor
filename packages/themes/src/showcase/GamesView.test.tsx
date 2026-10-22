// Cases ported from NextLevelOS src/themes/showcase/GamesView.test.tsx @ 3d530b7 on ThemeGames,
// with i18n wording and the last-played line from `lastPlayedAt`.
import type { ThemeGame } from '@nextlevel/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GamesView, type GamesViewProps } from './GamesView.tsx';

const game = (id: number, title: string, extra: Partial<ThemeGame> = {}): ThemeGame => ({
  id,
  systemId: 'wii',
  title,
  year: null,
  genre: null,
  players: null,
  developer: null,
  publisher: null,
  favorite: false,
  hidden: false,
  filters: [],
  playCount: 0,
  lastPlayedAt: null,
  media: [],
  ...extra,
});

const GAMES = [
  game(1, 'Alpha', {
    year: 2007,
    developer: 'Radical',
    genre: 'Action',
    players: '2',
    favorite: true,
  }),
  game(2, 'Beta'),
];

function props(over: Partial<GamesViewProps> = {}): GamesViewProps {
  return {
    title: 'Wii',
    systemLogo: [],
    game: GAMES[0] ?? null,
    videoCandidates: [],
    videoFor: 1,
    tabs: [
      { id: 'all', label: 'All', count: 2 },
      { id: 'favorites', label: 'Favorites', count: 1 },
    ],
    activeTabId: 'all',
    onSelectTab: vi.fn(),
    display: GAMES,
    displayFocus: 0,
    onFocusChange: vi.fn(),
    onActivate: vi.fn(),
    artCandidates: () => [],
    loading: false,
    ...over,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Showcase games view (FR-THM-1)', () => {
  it('shows the focused game info, its favorite badge and the count', () => {
    render(<GamesView {...props()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByText('2007 • Radical')).toBeInTheDocument();
    expect(screen.getByText('Action • 2 players')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Favorites' })).toBeInTheDocument();
    expect(screen.getByText('2 games')).toBeInTheDocument();
  });

  it('one player and a players range read naturally', () => {
    const { rerender } = render(
      <GamesView {...props({ game: game(3, 'Solo', { players: '1' }) })} />,
    );
    expect(screen.getByText('1 player')).toBeInTheDocument();
    rerender(<GamesView {...props({ game: game(3, 'Solo', { players: '1-4' }) })} />);
    expect(screen.getByText('1-4 players')).toBeInTheDocument();
  });

  it('shows when the game was last played', () => {
    vi.useFakeTimers({ now: new Date('2026-07-22T16:49:00Z'), toFake: ['Date'] });
    const { rerender } = render(
      <GamesView
        {...props({ game: game(4, 'Played', { lastPlayedAt: '2026-07-21T19:49:00Z' }) })}
      />,
    );
    expect(screen.getByText('Last played 21 hours ago')).toBeInTheDocument();
    rerender(
      <GamesView
        {...props({ game: game(4, 'Played', { lastPlayedAt: '2025-01-02T10:00:00Z' }) })}
      />,
    );
    expect(screen.getByText('Last played on Jan 2, 2025')).toBeInTheDocument();
    rerender(<GamesView {...props()} />);
    expect(screen.queryByText(/Last played/)).toBeNull();
  });

  it('shows the system logo (its name as text without art) above the game title', () => {
    const { container } = render(<GamesView {...props()} />);
    const logo = container.querySelector('.sc-info .sc-system-logo');
    expect(logo?.textContent).toBe('Wii');
    const title = screen.getByRole('heading', { level: 1, name: 'Alpha' });
    expect(
      (logo?.compareDocumentPosition(title) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('a filter shows as text under the system logo; none without a filter', () => {
    const { container, rerender } = render(<GamesView {...props({ filterLabel: 'Official' })} />);
    expect(container.querySelector('.sc-info .sc-system-filter')?.textContent).toBe('Official');
    rerender(<GamesView {...props()} />);
    expect(container.querySelector('.sc-system-filter')).toBeNull();
  });

  it('a video window only with candidates for the focused game', () => {
    const { container, rerender } = render(<GamesView {...props()} />);
    expect(container.querySelector('.sc-video')).toBeNull();
    rerender(<GamesView {...props({ videoCandidates: ['a.mp4'] })} />);
    expect(container.querySelector('.sc-video video')).not.toBeNull();
    // Focus moved, not settled yet: the other game's video stays hidden.
    rerender(<GamesView {...props({ videoCandidates: ['b.mp4'], videoFor: 2 })} />);
    expect(container.querySelector('.sc-video')).toBeNull();
  });

  it('a video that fails every candidate removes the window', () => {
    const { container } = render(<GamesView {...props({ videoCandidates: ['x.mp4'] })} />);
    const video = container.querySelector('video');
    if (video) fireEvent.error(video);
    expect(container.querySelector('.sc-video')).toBeNull();
  });

  it('an empty tab: no info, no window, a message', () => {
    const { container } = render(
      <GamesView {...props({ game: null, display: [], videoCandidates: ['x.mp4'] })} />,
    );
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(container.querySelector('.sc-video')).toBeNull();
    expect(screen.getByText('No games in this tab')).toBeInTheDocument();
    expect(screen.getByText('0 games')).toBeInTheDocument();
  });

  it('loading and error states', () => {
    const { rerender } = render(<GamesView {...props({ loading: true })} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    rerender(<GamesView {...props({ error: 'boom' })} />);
    expect(screen.getByText('Couldn’t load Wii')).toBeInTheDocument();
  });

  it('a cover without art falls back to its title', () => {
    render(<GamesView {...props()} />);
    expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
  });
});
