// Cases ported from NextLevelOS src/themes/components/GameGrid.test.tsx @ 3d530b7, on ThemeGames,
// with the FR-THM-3 mouse rule: a click focuses, a double-click plays.
import type { ThemeGame } from '@nextlevel/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_GAMES } from '../host/fixtures.ts';
import { GameGrid } from './GameGrid.tsx';

const games: ThemeGame[] = Array.from({ length: 14 }, (_, i) => ({
  ...(FIXTURE_GAMES[0] as ThemeGame),
  id: i + 1,
  title: `Game ${String(i)}`,
}));

function renderGrid(focusIndex = 0) {
  const onFocusChange = vi.fn();
  const onActivate = vi.fn();
  render(
    <GameGrid
      games={games}
      focusIndex={focusIndex}
      onFocusChange={onFocusChange}
      onActivate={onActivate}
      columns={6}
      rowHeight={100}
      renderCell={({ game, focused }) => (
        <span>
          {game.title}
          {focused ? ' *' : ''}
        </span>
      )}
    />,
  );
  return { onFocusChange, onActivate };
}

describe('GameGrid (FR-THM-1)', () => {
  it('renders every cell in rows of `columns`', () => {
    renderGrid();
    expect(screen.getByText('Game 13')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('marks the focused cell', () => {
    renderGrid(7);
    expect(screen.getByText('Game 7 *').closest('[data-index]')).toHaveAttribute(
      'data-focused',
      'true',
    );
  });

  it('FR-THM-3: a click focuses a cell, a double-click plays it', () => {
    const { onFocusChange, onActivate } = renderGrid(0);
    fireEvent.click(screen.getByText('Game 8'));
    expect(onFocusChange).toHaveBeenCalledWith(8);
    fireEvent.click(screen.getByText('Game 0 *'));
    expect(onActivate).not.toHaveBeenCalled();
    fireEvent.doubleClick(screen.getByText('Game 8'));
    expect(onActivate).toHaveBeenCalledWith(8);
  });

  it('FR-THM-3: the mouse wheel moves focus one row, clamped', () => {
    const { onFocusChange } = renderGrid(2);
    const grid = screen.getAllByRole('row')[0]?.closest('[data-grid]') as HTMLElement;
    fireEvent.wheel(grid, { deltaY: 100 });
    expect(onFocusChange).toHaveBeenLastCalledWith(8);
  });

  it('the wheel at the top row does nothing', () => {
    const { onFocusChange } = renderGrid(2);
    const grid = document.querySelector('[data-grid]') as HTMLElement;
    fireEvent.wheel(grid, { deltaY: -100 });
    expect(onFocusChange).not.toHaveBeenCalled();
  });

  it('locks each row to its height so tall cell content cannot spill into the next row', () => {
    renderGrid();
    const row = screen.getAllByRole('row')[0] as HTMLElement;
    expect(row.style.height).toBe('100px');
    expect(row.style.gridTemplateRows).toBe('minmax(0, 1fr)');
  });

  it('with cellAspect, sizes rows from the measured column width', () => {
    // 6 columns × 100px + 5 gaps × 20px = 700px of content width.
    const spy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(700);
    try {
      render(
        <GameGrid
          games={games}
          focusIndex={0}
          onFocusChange={() => {}}
          onActivate={() => {}}
          columns={6}
          rowHeight={190}
          gap={20}
          cellAspect={1}
          renderCell={({ game }) => <span>{game.title}</span>}
        />,
      );
      expect((screen.getAllByRole('row')[0] as HTMLElement).style.height).toBe('100px');
    } finally {
      spy.mockRestore();
    }
  });
});
