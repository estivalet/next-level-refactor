// Cases ported from NextLevelOS src/themes/components/Carousel.test.tsx @ 3d530b7, plus the
// FR-THM-3 mouse rules: a click focuses, a double-click activates, the wheel moves focus.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Carousel, shortestDelta } from './Carousel.tsx';

const items = Array.from({ length: 20 }, (_, i) => `item-${String(i)}`);

function renderItem({ item, index, focused }: { item: string; index: number; focused: boolean }) {
  return (
    <button type="button" data-testid={`slot-${String(index)}`} data-focused={focused}>
      {item}
    </button>
  );
}

function setup(focusIndex = 0) {
  const onFocusChange = vi.fn();
  const onActivate = vi.fn();
  const view = render(
    <Carousel
      items={items}
      focusIndex={focusIndex}
      onFocusChange={onFocusChange}
      onActivate={onActivate}
      itemWidth={100}
      visibleRadius={3}
      renderItem={renderItem}
    />,
  );
  return { onFocusChange, onActivate, view };
}

describe('Carousel (FR-THM-1)', () => {
  it('mounts only 2*radius+1 items', () => {
    setup(10);
    expect(screen.queryAllByTestId(/^slot-/)).toHaveLength(7);
  });

  it('wraps indices when loop is on', () => {
    setup(0);
    expect(screen.getByTestId('slot-17')).toBeInTheDocument();
    expect(screen.getByTestId('slot-3')).toBeInTheDocument();
  });

  it('marks the focused item', () => {
    setup(5);
    expect(screen.getByTestId('slot-5').getAttribute('data-focused')).toBe('true');
  });

  it('wrapping past an end shifts the track by a single step, not the whole width', () => {
    const { view } = setup(0);
    const beforeWrap = screen.getByTestId('slot-19');
    expect(beforeWrap.getAttribute('data-focused')).toBe('false');
    view.rerender(
      <Carousel
        items={items}
        focusIndex={19}
        onFocusChange={vi.fn()}
        onActivate={vi.fn()}
        itemWidth={100}
        visibleRadius={3}
        renderItem={renderItem}
      />,
    );
    const afterWrap = screen.getByTestId('slot-19');
    expect(afterWrap).toBe(beforeWrap);
    expect(afterWrap.getAttribute('data-focused')).toBe('true');
  });

  it('renders an empty track for no items', () => {
    const { container } = render(
      <Carousel
        items={[]}
        focusIndex={0}
        onFocusChange={vi.fn()}
        onActivate={vi.fn()}
        itemWidth={100}
        renderItem={renderItem}
      />,
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});

describe('Carousel mouse (FR-THM-3)', () => {
  it('a click on another item focuses it without activating', () => {
    const { onFocusChange, onActivate } = setup(5);
    fireEvent.click(screen.getByTestId('slot-6'));
    expect(onFocusChange).toHaveBeenCalledWith(6);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('a click on the focused item does not activate it', () => {
    const { onFocusChange, onActivate } = setup(5);
    fireEvent.click(screen.getByTestId('slot-5'));
    expect(onActivate).not.toHaveBeenCalled();
    expect(onFocusChange).not.toHaveBeenCalled();
  });

  it('a double-click activates the item', () => {
    const { onActivate } = setup(5);
    fireEvent.doubleClick(screen.getByTestId('slot-6'));
    expect(onActivate).toHaveBeenCalledWith(6);
  });

  it('the mouse wheel moves focus one step, wrapping', () => {
    const { onFocusChange, view } = setup(0);
    const track = view.container.firstElementChild as HTMLElement;
    fireEvent.wheel(track, { deltaY: -40 });
    expect(onFocusChange).toHaveBeenLastCalledWith(19);
  });
});

describe('shortestDelta', () => {
  it('wraps last → first as +1', () => {
    expect(shortestDelta(19, 0, 20)).toBe(1);
  });
  it('wraps first → last as -1', () => {
    expect(shortestDelta(0, 19, 20)).toBe(-1);
  });
  it('takes the short way around', () => {
    expect(shortestDelta(2, 5, 20)).toBe(3);
    expect(shortestDelta(5, 2, 20)).toBe(-3);
    expect(shortestDelta(1, 18, 20)).toBe(-3);
  });
  it('resolves the exact half-way tie forward', () => {
    expect(shortestDelta(0, 10, 20)).toBe(10);
  });
  it('is zero for no move', () => {
    expect(shortestDelta(7, 7, 20)).toBe(0);
  });
});
