// Cases ported from NextLevelOS src/themes/showcase/HomeView.test.tsx and HomeView.layout.test.tsx
// @ 3d530b7 on MenuNodes.
import type { MenuNode } from '@nextlevel/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeView, SC_GAP, SC_INSET, SC_TILE, type HomeViewProps } from './HomeView.tsx';

const shelfProps = vi.hoisted(() => ({ last: null as { leadingInset?: number } | null }));
vi.mock('../components/ShelfRow.tsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/ShelfRow.tsx')>();
  return {
    ...actual,
    ShelfRow: (p: Parameters<typeof actual.ShelfRow>[0]) => {
      shelfProps.last = p;
      return actual.ShelfRow(p);
    },
  };
});

const node = (name: string, children: MenuNode[] = []): MenuNode => ({
  id: `s:${name}`,
  name,
  display: name,
  type: 'system',
  systemId: name.toLowerCase(),
  children,
});

const ITEMS = [node('PC Gamer'), node('Xbox'), node('Wii')];

function props(over: Partial<HomeViewProps> = {}): HomeViewProps {
  return {
    categories: [
      { ...node('Consoles', ITEMS), id: 'm:consoles', type: 'category' },
      { ...node('Arcade'), id: 'm:arcade', type: 'category' },
    ],
    activeCategory: 0,
    onSelectCategory: vi.fn(),
    trail: '',
    clock: <span>12:00</span>,
    items: ITEMS,
    focusIndex: 0,
    onFocusChange: vi.fn(),
    onActivate: vi.fn(),
    imageCandidates: () => [],
    logoCandidates: () => [],
    hardwareCandidates: () => [],
    description: 'The supreme console.',
    countText: '88 games',
    ...over,
  };
}

describe('Showcase home (FR-THM-1)', () => {
  it('renders category tabs with the active one selected', () => {
    render(<HomeView {...props()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Consoles', 'Arcade']);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
  });

  it('the focused tile alone has a Start bar, and a click on it starts', () => {
    const p = props();
    render(<HomeView {...p} />);
    fireEvent.click(screen.getByText('Start'));
    expect(p.onActivate).toHaveBeenCalledWith(0);
  });

  it('repeats a short list so the row is full', () => {
    const { container } = render(<HomeView {...props()} />);
    expect(container.querySelectorAll('[data-slot]').length).toBeGreaterThan(ITEMS.length);
  });

  it('a tile without art shows its clear logo, then its name once the logo fails too', () => {
    const { container } = render(
      <HomeView {...props({ logoCandidates: (n) => (n === 'Xbox' ? ['logo://xbox'] : []) })} />,
    );
    const logos = [
      ...container.querySelectorAll<HTMLImageElement>('.sc-tile-fallback img.sc-tile-logo'),
    ];
    expect(logos.length).toBeGreaterThan(0);
    expect(logos.every((l) => l.getAttribute('src') === 'logo://xbox' && l.alt === 'Xbox')).toBe(
      true,
    );
    logos.forEach((l) => fireEvent.error(l));
    expect(container.querySelector('.sc-tile-fallback img')).toBeNull();
    expect(
      [...container.querySelectorAll('.sc-tile-fallback')].some((el) => el.textContent === 'Xbox'),
    ).toBe(true);
  });

  it('the hero shows the name and the description, else the count', () => {
    const { rerender } = render(<HomeView {...props()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'PC Gamer' })).toBeInTheDocument();
    expect(screen.getByText('The supreme console.')).toBeInTheDocument();
    expect(screen.queryByText('88 games')).toBeNull();
    rerender(<HomeView {...props({ description: null })} />);
    expect(screen.getByText('88 games')).toBeInTheDocument();
  });

  it('an empty category says so', () => {
    render(<HomeView {...props({ items: [] })} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shelf geometry: half a tile of inset; a single item sits where the focused tile does', () => {
    render(<HomeView {...props()} />);
    expect(shelfProps.last?.leadingInset).toBe(SC_INSET);
    render(<HomeView {...props({ items: [node('Solo')] })} />);
    expect(shelfProps.last?.leadingInset).toBe(SC_INSET + SC_TILE + SC_GAP);
  });
});
