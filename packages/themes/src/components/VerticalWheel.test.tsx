// Cases ported from NextLevelOS src/themes/components/VerticalWheel.test.tsx @ 3d530b7, with the
// FR-THM-3 mouse rule: a click focuses, a double-click activates.
import { fireEvent, render } from '@testing-library/react';
import { StrictMode, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VerticalWheel, wheelSlotStyle, type WheelSlotStyle } from './VerticalWheel.tsx';

describe('wheelSlotStyle', () => {
  it('is the neutral pose at the center', () => {
    expect(wheelSlotStyle(0, 100)).toEqual({ y: 0, x: 0, scale: 1, opacity: 1, zIndex: 100 });
  });
  it('is symmetric above and below', () => {
    const up = wheelSlotStyle(-2, 100);
    const down = wheelSlotStyle(2, 100);
    expect(up.y).toBeCloseTo(-down.y);
    expect(up.x).toBe(down.x);
    expect(up.scale).toBe(down.scale);
  });
  it('moves out, curves right, shrinks and dims with distance', () => {
    for (let a = 0; a < 6; a++) {
      const s = wheelSlotStyle(a, 100);
      const t = wheelSlotStyle(a + 1, 100);
      expect(t.y).toBeGreaterThan(s.y);
      expect(t.x).toBeGreaterThan(s.x);
      expect(t.scale).toBeLessThanOrEqual(s.scale);
      expect(t.opacity).toBeLessThanOrEqual(s.opacity);
      expect(t.zIndex).toBeLessThan(s.zIndex);
    }
  });
});

const ITEMS = Array.from({ length: 20 }, (_, i) => `Item ${String(i)}`);

const opaque = (d: number) => ({ ...wheelSlotStyle(d, 100), opacity: 1 });

interface WheelOptions {
  items?: string[];
  strict?: boolean;
  slotStyle?: (d: number) => WheelSlotStyle;
  fill?: boolean;
}

function renderWheel(focusIndex: number, opts: WheelOptions = {}) {
  const onFocusChange = vi.fn();
  const onActivate = vi.fn();
  const props = {
    items: opts.items ?? ITEMS,
    onFocusChange,
    onActivate,
    slotHeight: 100,
    slotStyle: opts.slotStyle,
    fill: opts.fill,
    renderItem: ({ item, focused }: { item: string; focused: boolean }) => (
      <span>
        {item}
        {focused ? ' *' : ''}
      </span>
    ),
  };
  const wrap = (el: ReactElement) => (opts.strict ? <StrictMode>{el}</StrictMode> : el);
  const utils = render(wrap(<VerticalWheel {...props} focusIndex={focusIndex} />));
  const rerender = (fi: number, items?: string[]) => {
    utils.rerender(wrap(<VerticalWheel {...props} items={items ?? props.items} focusIndex={fi} />));
  };
  const focused = () => utils.container.querySelector('[data-focused="true"]') as HTMLElement;
  const slots = () => Array.from(utils.container.querySelectorAll<HTMLElement>('[data-slot]'));
  const at = (k: number) => slots().find((s) => s.dataset.virtual === String(k));
  return { onFocusChange, onActivate, rerender, focused, slots, at, container: utils.container };
}

describe('VerticalWheel (FR-THM-1)', () => {
  it('fill repeats a short list around the ring', () => {
    const { slots, focused } = renderWheel(0, { items: ['A', 'B', 'C'], fill: true });
    expect(slots()).toHaveLength(13);
    expect(slots().filter((s) => s.dataset.index === '0').length).toBeGreaterThan(1);
    expect(focused().dataset.index).toBe('0');
  });

  it('fill: clicking another copy of the focused item moves the wheel to that copy', () => {
    const { slots, focused, onFocusChange, onActivate } = renderWheel(0, {
      items: ['A', 'B', 'C'],
      fill: true,
    });
    const copy = slots().find((s) => s.dataset.index === '0' && s.dataset.distance !== '0');
    const k = copy?.dataset.virtual;
    fireEvent.click(copy as HTMLElement);
    expect(onFocusChange).not.toHaveBeenCalled();
    expect(onActivate).not.toHaveBeenCalled();
    expect(focused().dataset.virtual).toBe(k);
  });

  it('fill shows a single item once', () => {
    expect(renderWheel(0, { items: ['Only'], fill: true }).slots()).toHaveLength(1);
  });

  it('without fill a short list shows each item once', () => {
    const { slots } = renderWheel(0, { items: ['A', 'B', 'C'] });
    expect(
      slots()
        .map((s) => s.dataset.index)
        .sort(),
    ).toEqual(['0', '1', '2']);
  });

  it('renders the focus at distance 0 plus radius + 1 slots on each side', () => {
    const { focused, slots, at } = renderWheel(4);
    expect(focused().dataset.index).toBe('4');
    expect(focused().dataset.distance).toBe('0');
    expect(slots()).toHaveLength(13);
    expect(at(1)?.dataset.distance).toBe('-3');
    expect(at(10)?.dataset.index).toBe('10');
  });

  it('wrapping last → first steps forward instead of rewinding', () => {
    const { rerender, focused } = renderWheel(19);
    rerender(0);
    expect(focused().dataset.index).toBe('0');
    expect(focused().dataset.virtual).toBe('20');
  });

  it('wrapping first → last steps back', () => {
    const { rerender, focused } = renderWheel(0);
    rerender(19);
    expect(focused().dataset.virtual).toBe('-1');
  });

  it('shows the ring end above the first item', () => {
    expect(renderWheel(0).at(-1)?.dataset.index).toBe('19');
  });

  it('clicking an unfocused item focuses that copy, not the nearest one', () => {
    const { rerender, focused, onFocusChange, at } = renderWheel(0, {
      items: ITEMS.slice(0, 12),
      slotStyle: opaque,
    });
    fireEvent.click(at(-6) as HTMLElement);
    expect(onFocusChange).toHaveBeenCalledWith(6);
    rerender(6);
    expect(focused().dataset.virtual).toBe('-6');
  });

  it('click targets the clicked copy under StrictMode', () => {
    const { rerender, focused, at } = renderWheel(0, {
      items: ITEMS.slice(0, 12),
      strict: true,
      slotStyle: opaque,
    });
    fireEvent.click(at(-6) as HTMLElement);
    rerender(6);
    expect(focused().dataset.virtual).toBe('-6');
  });

  it('invisible overscan slots do not receive pointer events', () => {
    const { slots } = renderWheel(0);
    const atDistance = (d: number) => slots().find((s) => s.dataset.distance === String(d));
    expect(atDistance(6)?.style.pointerEvents).toBe('none'); // radius 5 + 1, opacity 0
    expect(atDistance(-6)?.style.pointerEvents).toBe('none');
    expect(atDistance(5)?.style.pointerEvents).not.toBe('none');
  });

  it('FR-THM-3: a click on the focused item does nothing, a double-click activates it', () => {
    const { onActivate, focused, at } = renderWheel(3);
    fireEvent.click(focused());
    expect(onActivate).not.toHaveBeenCalled();
    fireEvent.doubleClick(focused());
    expect(onActivate).toHaveBeenCalledWith(3);
    fireEvent.doubleClick(at(5) as HTMLElement);
    expect(onActivate).toHaveBeenLastCalledWith(5);
  });

  it('FR-THM-3: the mouse wheel moves the focus with wrap', () => {
    const { onFocusChange, container } = renderWheel(0);
    fireEvent.wheel(container.firstChild as HTMLElement, { deltaY: -100 });
    expect(onFocusChange).toHaveBeenCalledWith(19);
  });

  it('the mouse wheel on a single item does nothing', () => {
    const { onFocusChange, container } = renderWheel(0, { items: ['Solo'] });
    fireEvent.wheel(container.firstChild as HTMLElement, { deltaY: 100 });
    expect(onFocusChange).not.toHaveBeenCalled();
  });

  it('rebases when the item count changes (no long sweep)', () => {
    const { rerender, focused } = renderWheel(0);
    rerender(19);
    expect(focused().dataset.virtual).toBe('-1');
    rerender(5, ITEMS.slice(0, 10));
    expect(focused().dataset.virtual).toBe('5');
    expect(focused().dataset.index).toBe('5');
  });

  it('renders no slots for an empty list', () => {
    expect(renderWheel(0, { items: [] }).slots()).toHaveLength(0);
  });
});

describe('VerticalWheel sizing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('without a radius, renders enough slots to fill its measured height', () => {
    // 1400px tall, 100px slots → 7 per side to reach the edges, plus 1 overscan each.
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1400);
    expect(renderWheel(0).slots()).toHaveLength(17);
  });

  it('an explicit radius wins over the measured height', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1400);
    const { container } = render(
      <VerticalWheel
        items={ITEMS}
        focusIndex={0}
        onFocusChange={() => {}}
        onActivate={() => {}}
        slotHeight={100}
        radius={3}
        renderItem={({ item }) => <span>{item}</span>}
      />,
    );
    expect(container.querySelectorAll('[data-slot]')).toHaveLength(9);
  });

  it('spacing below 1 mounts more slots so the wheel still fills its height', () => {
    // 1400px tall, 100px slots 0.5 apart → 14 per side, plus 1 overscan each.
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1400);
    const many = Array.from({ length: 60 }, (_, i) => `Item ${String(i)}`);
    const { container } = render(
      <VerticalWheel
        items={many}
        focusIndex={0}
        onFocusChange={() => {}}
        onActivate={() => {}}
        slotHeight={100}
        spacing={0.5}
        renderItem={({ item }) => <span>{item}</span>}
      />,
    );
    expect(container.querySelectorAll('[data-slot]')).toHaveLength(31);
  });
});
