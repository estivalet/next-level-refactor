// Cases ported from NextLevelOS src/themes/big-box/MenuView.test.tsx and palette.test.ts @ 3d530b7.
import type { MenuNode } from '@nextlevel/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeHostContext } from '../engine/useThemeNavigation.ts';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { FIXTURE_MENU } from '../host/fixtures.ts';
import { MenuView, type MenuLevel } from './MenuView.tsx';
import { accentFor } from './palette.ts';

const level: MenuLevel = {
  kind: 'menu',
  node: null,
  title: 'NextLevel',
  items: FIXTURE_MENU.items,
  lastFocusIndex: 0,
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeHostContext.Provider value={new FakeThemeHost()}>{children}</ThemeHostContext.Provider>
  );
}

function renderMenu(props: Partial<Parameters<typeof MenuView>[0]> = {}) {
  const onEnter = vi.fn();
  const onBack = vi.fn();
  const view = render(
    <MenuView
      level={level}
      focusIndex={1}
      trail={[]}
      onFocusChange={vi.fn()}
      onEnter={onEnter}
      onBack={onBack}
      {...props}
    />,
    { wrapper },
  );
  return { onEnter, onBack, view };
}

describe('Big Box MenuView (FR-THM-1)', () => {
  it('shows the focused item in the card, the level title and count, and its own count', () => {
    const { view } = renderMenu();
    const card = view.container.querySelector('.bigbox-card');
    expect(card).toHaveTextContent('Sega');
    expect(card).toHaveTextContent('2 items');
    expect(screen.getAllByText('NextLevel').length).toBeGreaterThan(0);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows the game count of a focused system once it settles', async () => {
    const { view } = renderMenu({
      level: { ...level, items: (FIXTURE_MENU.items[1] as MenuNode).children },
      focusIndex: 0,
    });
    await waitFor(() => {
      expect(view.container.querySelector('.bigbox-card')).toHaveTextContent('8 games');
    });
  });

  it('translates generated category names', () => {
    renderMenu({ focusIndex: 2 });
    expect(document.querySelector('.bigbox-card')).toHaveTextContent('Collections');
  });

  it('Open enters the focused item; Back goes back (FR-THM-3)', () => {
    const { onEnter, onBack } = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(onEnter).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('an empty level says Nothing here', () => {
    renderMenu({ level: { ...level, items: [] }, focusIndex: 0 });
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});

describe('Big Box accentFor', () => {
  it('returns a distinct accent per known manufacturer', () => {
    expect(accentFor('Nintendo').accent).not.toBe(accentFor('Sega').accent);
  });

  it('is neutral without a top-level item and stable for unknown names', () => {
    expect(accentFor(null).accent).toBe('#94a3b8');
    expect(accentFor('Bandai')).toEqual(accentFor('Bandai'));
  });
});
