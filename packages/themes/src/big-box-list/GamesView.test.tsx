// Cases ported from NextLevelOS src/themes/big-box-list/GamesView.test.tsx @ 3d530b7: the line
// under the logo shows year · developer · genre (themes get no ROM paths), strings via i18n.
import type { ThemeGame } from '@nextlevel/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_GAMES } from '../host/fixtures.ts';
import { GamesView, gameMeta, listSlotStyle } from './GamesView.tsx';

const base = FIXTURE_GAMES[0] as ThemeGame;
const GAMES: ThemeGame[] = [
  { ...base, id: 1, title: 'Astro Run', year: 1994, developer: 'Neon', genre: 'Platform' },
  { ...base, id: 2, title: 'Pathless', year: null, developer: null, genre: null },
];

function view(over: Partial<Parameters<typeof GamesView>[0]> = {}) {
  const props = {
    title: 'Nintendo 64',
    badge: 'N64' as string | null,
    games: GAMES,
    focusIndex: 0,
    focusedGame: GAMES[0] ?? null,
    boxArtSrcs: [] as string[],
    logoSrcs: [] as string[],
    filterLabel: null as string | null,
    status: 'ready' as 'ready' | 'loading' | 'error',
    hints: [],
    onFocusChange: vi.fn(),
    onActivate: vi.fn(),
    onToggleSearch: vi.fn(),
    ...over,
  };
  const utils = render(<GamesView {...props} />);
  return { ...utils, props };
}

describe('Big Box List helpers', () => {
  it('listSlotStyle is a flat column: no curve, no shrink, dims with distance', () => {
    expect(listSlotStyle(0, 50)).toEqual({ y: 0, x: 0, scale: 1, opacity: 1, zIndex: 100 });
    expect(listSlotStyle(-2, 50).y).toBe(-100);
    expect(listSlotStyle(3, 50).x).toBe(0);
    expect(listSlotStyle(3, 50).scale).toBe(1);
    expect(listSlotStyle(1, 50).opacity).toBeLessThan(1);
    expect(listSlotStyle(4, 50).opacity).toBeLessThan(listSlotStyle(1, 50).opacity);
    expect(listSlotStyle(30, 50).opacity).toBeGreaterThan(0);
  });

  it('gameMeta joins year, developer and genre, skipping blanks', () => {
    expect(gameMeta(GAMES[0] as ThemeGame)).toBe('1994 · Neon · Platform');
    expect(gameMeta(GAMES[1] as ThemeGame)).toBe('');
  });
});

describe('Big Box List games view (FR-THM-1)', () => {
  it('shows brand, title, count, the focused row, badge and the game line', () => {
    const { container } = view();
    expect(screen.getByText('NEXTLEVEL')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nintendo 64' })).toBeInTheDocument();
    expect(container.querySelector('.bbl-count')?.textContent).toBe('2 games');
    expect(container.querySelector('.bbl-row--focused')?.textContent).toBe('Astro Run');
    expect(screen.getByText('N64')).toBeInTheDocument();
    expect(screen.getByText('1994 · Neon · Platform')).toBeInTheDocument();
  });

  it('shows the game clear logo above the badge line', () => {
    const { container } = view({ logoSrcs: ['nextlevel://media/1/logo-clear'] });
    const logo = screen.getByAltText<HTMLImageElement>('Astro Run');
    expect(logo.src).toBe('nextlevel://media/1/logo-clear');
    const info = container.querySelector('.bbl-game-info');
    expect(info?.firstElementChild).toContainElement(logo);
  });

  it('a game without a clear logo shows its title instead', () => {
    const { container } = view();
    expect(container.querySelector('.bbl-logo-text')?.textContent).toBe('Astro Run');
  });

  it('no game info without a focused game', () => {
    const { container } = view({ games: [], focusedGame: null });
    expect(container.querySelector('.bbl-game-info')).toBeNull();
  });

  it('shows the filter next to the count', () => {
    const { container } = view({ filterLabel: 'Official' });
    expect(container.querySelector('.bbl-count')?.textContent).toBe('2 games · Official');
    expect(container.querySelector('.bbl-count-filter')?.textContent).toBe('Official');
  });

  it('no badge without a short name', () => {
    const { container } = view({ badge: null });
    expect(container.querySelector('.bbl-badge')).toBeNull();
  });

  it('the search icon calls onToggleSearch and does not take focus on mousedown', () => {
    const { props } = view();
    const button = screen.getByRole('button', { name: 'Search titles' });
    expect(fireEvent.mouseDown(button)).toBe(false);
    fireEvent.click(button);
    expect(props.onToggleSearch).toHaveBeenCalled();
  });

  it('loading hides the count', () => {
    const { container } = view({ status: 'loading', games: [], focusedGame: null });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(container.querySelector('.bbl-count')).toBeNull();
  });

  it('error names the level', () => {
    view({ status: 'error', games: [], focusedGame: null });
    expect(screen.getByText('Couldn’t load Nintendo 64')).toBeInTheDocument();
  });

  it('no games: message and 0 games', () => {
    const { container } = view({ games: [], focusedGame: null });
    expect(screen.getByText('No games')).toBeInTheDocument();
    expect(container.querySelector('.bbl-count')?.textContent).toBe('0 games');
  });

  it('renders the search and tab slots in the header', () => {
    view({ search: <input aria-label="query" />, tabs: <div role="tablist" /> });
    expect(screen.getByLabelText('query')).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('FR-THM-3: a double-click on a row plays it', () => {
    const { props } = view();
    fireEvent.doubleClick(screen.getAllByText('Pathless')[0] as HTMLElement);
    expect(props.onActivate).toHaveBeenCalledWith(1);
  });
});
