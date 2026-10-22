// Cases ported from NextLevelOS src/themes/components/ShelfRow.test.tsx @ 3d530b7, with the
// FR-THM-3 mouse rule: a click focuses, a double-click activates.
import { fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ShelfRow, shelfWindowStart } from './ShelfRow.tsx';

describe('shelfWindowStart', () => {
  it('stays put while focus is inside the window', () => {
    expect(shelfWindowStart(0, 3, 4)).toBe(0);
  });
  it('shifts right just enough past the right edge', () => {
    expect(shelfWindowStart(0, 5, 4)).toBe(2);
  });
  it('shifts left to the focus before the start', () => {
    expect(shelfWindowStart(5, 3, 4)).toBe(3);
  });
  it('keeps shifting past the ring ends (no clamp)', () => {
    expect(shelfWindowStart(7, 10, 4)).toBe(7);
    expect(shelfWindowStart(7, 11, 4)).toBe(8);
    expect(shelfWindowStart(0, -1, 4)).toBe(-1);
  });
});

const ITEMS = Array.from({ length: 10 }, (_, i) => `Item ${String(i)}`);

interface ShelfOptions {
  items?: string[];
  loop?: boolean;
  visibleCount?: number;
  strict?: boolean;
  focusSlot?: number;
  repeat?: 'overflow' | 'always';
}

function renderShelf(focusIndex: number, opts: ShelfOptions = {}) {
  const onFocusChange = vi.fn();
  const onActivate = vi.fn();
  const props = {
    items: opts.items ?? ITEMS,
    onFocusChange,
    onActivate,
    itemWidth: 100,
    focusedWidth: 150,
    gap: 10,
    visibleCount: opts.visibleCount ?? 4,
    loop: opts.loop,
    focusSlot: opts.focusSlot,
    repeat: opts.repeat,
    renderItem: ({ item, focused }: { item: string; focused: boolean }) => (
      <span>
        {item}
        {focused ? ' *' : ''}
      </span>
    ),
  };
  const wrapStrict = (el: ReactElement) => (opts.strict ? <StrictMode>{el}</StrictMode> : el);
  const utils = render(wrapStrict(<ShelfRow {...props} focusIndex={focusIndex} />));
  const rerender = (fi: number, items?: string[], visibleCount?: number) => {
    utils.rerender(
      wrapStrict(
        <ShelfRow
          {...props}
          items={items ?? props.items}
          visibleCount={visibleCount ?? props.visibleCount}
          focusIndex={fi}
        />,
      ),
    );
  };
  const focusedSlot = () => utils.container.querySelector('[data-focused="true"]') as HTMLElement;
  const at = (k: number) => utils.container.querySelector(`[data-virtual="${String(k)}"]`);
  const windowStart = () => utils.container.firstElementChild?.getAttribute('data-window-start');
  return { ...utils, onFocusChange, onActivate, rerender, focusedSlot, at, windowStart };
}

describe('ShelfRow (FR-THM-1)', () => {
  it('repeat="always" repeats a short list around the ring', () => {
    const { container, focusedSlot, at, windowStart } = renderShelf(0, {
      items: ['A', 'B', 'C'],
      repeat: 'always',
      focusSlot: 1,
    });
    // visibleCount 4 + 2 overscan each side + 1 → 9 slots, data indices wrapping A B C.
    expect(container.querySelectorAll('[data-slot]')).toHaveLength(9);
    expect(focusedSlot().dataset.virtual).toBe('0');
    expect((at(-1) as HTMLElement).dataset.index).toBe('2');
    expect(windowStart()).toBe('-1');
  });

  it('repeat="always" wraps last → first one step forward', () => {
    const { rerender, focusedSlot } = renderShelf(2, { items: ['A', 'B', 'C'], repeat: 'always' });
    rerender(0, ['A', 'B', 'C']);
    expect(focusedSlot().dataset.index).toBe('0');
    expect(focusedSlot().dataset.virtual).toBe('3');
  });

  it('repeat="always" with a single item renders it once', () => {
    const { container } = renderShelf(0, { items: ['Only'], repeat: 'always', focusSlot: 1 });
    expect(container.querySelectorAll('[data-slot]')).toHaveLength(1);
  });

  it('renders items and marks the focused one', () => {
    const { focusedSlot } = renderShelf(0);
    expect(screen.getByText('Item 0 *')).toBeInTheDocument();
    expect(focusedSlot().dataset.index).toBe('0');
  });

  it('FR-THM-3: a click focuses an item, a double-click activates it', () => {
    const { onFocusChange, onActivate } = renderShelf(0);
    fireEvent.click(screen.getByText('Item 2'));
    expect(onFocusChange).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByText('Item 0 *'));
    expect(onActivate).not.toHaveBeenCalled();
    fireEvent.doubleClick(screen.getByText('Item 2'));
    expect(onActivate).toHaveBeenCalledWith(2);
  });

  it('wrapping last → first steps one slot forward instead of rewinding', () => {
    const { rerender, focusedSlot } = renderShelf(9);
    expect(focusedSlot().dataset.virtual).toBe('9');
    rerender(0);
    expect(focusedSlot().dataset.index).toBe('0');
    expect(focusedSlot().dataset.virtual).toBe('10');
  });

  it('wrapping first → last steps one slot back', () => {
    const { rerender, focusedSlot } = renderShelf(0);
    rerender(9);
    expect(focusedSlot().dataset.virtual).toBe('-1');
  });

  it('does not repeat items when they all fit in the window', () => {
    const { container } = renderShelf(0, { items: ['A', 'B', 'C'] });
    expect(container.querySelectorAll('[data-slot]')).toHaveLength(3);
  });

  it('with loop=false the position is the data index (no wrap steps)', () => {
    const { rerender, focusedSlot } = renderShelf(9, { loop: false });
    rerender(0);
    expect(focusedSlot().dataset.virtual).toBe('0');
  });

  it('clicking a visible repeated item focuses that copy, not the nearest one', () => {
    const { rerender, focusedSlot, onFocusChange, at } = renderShelf(0, { visibleCount: 7 });
    fireEvent.click(at(6) as HTMLElement);
    expect(onFocusChange).toHaveBeenCalledWith(6);
    rerender(6);
    expect(focusedSlot().dataset.virtual).toBe('6');
  });

  it('click targets the clicked copy under StrictMode double render', () => {
    const { rerender, focusedSlot, at } = renderShelf(0, { visibleCount: 7, strict: true });
    fireEvent.click(at(6) as HTMLElement);
    rerender(6);
    expect(focusedSlot().dataset.virtual).toBe('6');
  });

  it('rebases the window into range when repeat turns off (fewer items)', () => {
    const { rerender, focusedSlot, windowStart } = renderShelf(0);
    rerender(9);
    expect(focusedSlot().dataset.virtual).toBe('-1');
    rerender(2, ['A', 'B', 'C']);
    expect(focusedSlot().dataset.virtual).toBe('2');
    expect(windowStart()).toBe('0');
  });

  it('rebases the window into range when repeat turns off (larger visibleCount)', () => {
    const { rerender, focusedSlot, windowStart } = renderShelf(0);
    rerender(9);
    expect(focusedSlot().dataset.virtual).toBe('-1');
    rerender(9, undefined, 12);
    expect(focusedSlot().dataset.virtual).toBe('9');
    expect(windowStart()).toBe('0');
  });

  it('the wheel at a non-looping edge does nothing', () => {
    const { onFocusChange, container } = renderShelf(0, { loop: false });
    fireEvent.wheel(container.firstChild as HTMLElement, { deltaY: -100 });
    expect(onFocusChange).not.toHaveBeenCalled();
  });

  it('FR-THM-3: the wheel moves focus one step', () => {
    const { onFocusChange, container } = renderShelf(0, { loop: false });
    fireEvent.wheel(container.firstChild as HTMLElement, { deltaY: 100 });
    expect(onFocusChange).toHaveBeenCalledWith(1);
  });

  describe('focusSlot (fixed focus position)', () => {
    it('keeps the focused item at the given slot; the shelf slides instead', () => {
      const { rerender, focusedSlot, windowStart } = renderShelf(0, { focusSlot: 2 });
      expect(windowStart()).toBe('-2');
      rerender(1);
      expect(windowStart()).toBe('-1');
      rerender(2);
      expect(windowStart()).toBe('0');
      expect(focusedSlot().dataset.virtual).toBe('2');
    });

    it('shows the last items of the ring before the first item', () => {
      const { at } = renderShelf(0, { focusSlot: 2 });
      expect(at(-1)?.getAttribute('data-index')).toBe('9');
      expect(at(-2)?.getAttribute('data-index')).toBe('8');
    });

    it('stays anchored while wrapping last → first', () => {
      const { rerender, focusedSlot, windowStart } = renderShelf(9, { focusSlot: 2 });
      rerender(0);
      expect(focusedSlot().dataset.virtual).toBe('10');
      expect(windowStart()).toBe('8');
    });

    it('falls back to edge scrolling when the items do not repeat', () => {
      const { rerender, windowStart } = renderShelf(0, { focusSlot: 2, items: ['A', 'B', 'C'] });
      expect(windowStart()).toBe('0');
      rerender(2, ['A', 'B', 'C']);
      expect(windowStart()).toBe('0');
    });
  });
});
