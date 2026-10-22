// Ported from NextLevelOS src/themes/components/VerticalWheel.tsx @ 3d530b7. Mouse (FR-THM-3): a
// click focuses, a double-click activates, the wheel moves focus one step. The clicked copy is kept
// in state instead of a ref read during render.
import { motion } from 'motion/react';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { carouselSlide } from '../engine/transitions.ts';
import { shortestDelta } from './Carousel.tsx';
import { cn } from './cn.ts';

const WHEEL_DEBOUNCE_MS = 80;
const FALLBACK_RADIUS = 5;

function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}

export interface WheelSlotStyle {
  y: number;
  x: number;
  scale: number;
  opacity: number;
  zIndex: number;
}

/**
 * HyperSpin arc: slot pose at `distance` slots from the center (negative = above). Slots move
 * out, bend right, shrink and dim with distance.
 */
export function wheelSlotStyle(distance: number, slotHeight: number): WheelSlotStyle {
  const a = Math.abs(distance);
  const sign = Math.sign(distance);
  return {
    y: sign * slotHeight * (a - 0.06 * a * a),
    x: 14 * a * a,
    scale: Math.max(0.55, 1 - 0.12 * a),
    opacity: Math.max(0, 1 - 0.17 * a),
    zIndex: 100 - Math.round(a),
  };
}

/** A click on another copy of an item: the virtual slot to land on once focus reaches it. */
export interface PendingSlot {
  k: number;
  /** The focus when the click happened; the pending slot only applies to that change. */
  from: number;
}

/**
 * Next virtual (unwrapped) position on a ring of `n` when focus moves `from` → `to`: the clicked
 * copy if one is pending for this change, else one shortest step.
 */
export function nextVirtual(
  virtual: number,
  from: number,
  to: number,
  n: number,
  pending: PendingSlot | null,
): number {
  if (pending && pending.from === from && n > 0 && wrap(pending.k, n) === to) return pending.k;
  return virtual + shortestDelta(from, to, n);
}

export interface VerticalWheelProps<T> {
  items: readonly T[];
  focusIndex: number;
  onFocusChange: (index: number) => void;
  onActivate: (index: number) => void;
  renderItem: (args: { item: T; index: number; focused: boolean; distance: number }) => ReactNode;
  /** Slot height in px at distance 0 (other slots scale down). */
  slotHeight: number;
  /** Distance between slot centers as a multiple of `slotHeight` (default 1); sizes the window. */
  spacing?: number | undefined;
  /** Slots on each side of the center. Default: enough to reach both edges (5 until measured). */
  radius?: number | undefined;
  /** Arc shape; defaults to `wheelSlotStyle`. */
  slotStyle?: ((distance: number) => WheelSlotStyle) | undefined;
  /** Repeat a short list around the ring so it wraps visibly (one item still shows once). */
  fill?: boolean | undefined;
  className?: string;
}

/**
 * Controlled vertical wheel (HyperSpin-style). The focus stays at the vertical center and the
 * ring rotates under it, wrapping forever. Only a window of slots around the focus is mounted.
 */
export function VerticalWheel<T>({
  items,
  focusIndex,
  onFocusChange,
  onActivate,
  renderItem,
  slotHeight,
  spacing = 1,
  radius: radiusOverride,
  slotStyle,
  fill = false,
  className,
}: VerticalWheelProps<T>) {
  const n = items.length;
  const rootRef = useRef<HTMLDivElement>(null);
  const wheelAt = useRef(0);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (radiusOverride !== undefined) return;
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      setHeight(el.clientHeight);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [radiusOverride]);

  const step = slotHeight * spacing;
  const radius =
    radiusOverride ??
    (height > 0 && step > 0 ? Math.max(1, Math.ceil(height / 2 / step)) : FALLBACK_RADIUS);
  const repeat = fill ? n > 1 : n > 2 * radius + 1;

  const [virtual, setVirtual] = useState(focusIndex);
  const [prevFocus, setPrevFocus] = useState(focusIndex);
  const [prevN, setPrevN] = useState(n);
  const [pending, setPending] = useState<PendingSlot | null>(null);
  let v = virtual;
  if (n !== prevN) {
    setPrevN(n);
    setPrevFocus(focusIndex);
    setVirtual(focusIndex);
    setPending(null);
    v = focusIndex;
  } else if (focusIndex !== prevFocus) {
    v = nextVirtual(virtual, prevFocus, focusIndex, n, pending);
    setPrevFocus(focusIndex);
    setVirtual(v);
    setPending(null);
  }

  if (n === 0) {
    return <div ref={rootRef} data-wheel className={cn('relative overflow-hidden', className)} />;
  }

  const style = slotStyle ?? ((d: number) => wheelSlotStyle(d, slotHeight));
  const from = repeat ? v - radius - 1 : v - Math.floor((n - 1) / 2);
  const to = repeat ? v + radius + 1 : v + Math.ceil((n - 1) / 2);
  const slots: number[] = [];
  for (let k = from; k <= to; k++) slots.push(k);

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - wheelAt.current < WHEEL_DEBOUNCE_MS || event.deltaY === 0) return;
    wheelAt.current = now;
    const next = wrap(focusIndex + (event.deltaY > 0 ? 1 : -1), n);
    if (next !== focusIndex) onFocusChange(next);
  };

  return (
    <div
      ref={rootRef}
      data-wheel
      className={cn('relative overflow-hidden', className)}
      onWheel={onWheel}
    >
      {slots.map((k) => {
        const index = wrap(k, n);
        const d = k - v;
        const focused = d === 0;
        const s = style(d);
        // New slots slide in from one step further out.
        const enter = style(d + Math.sign(d));
        return (
          <motion.div
            key={k}
            data-slot
            data-index={index}
            data-virtual={k}
            data-distance={d}
            data-focused={focused ? 'true' : undefined}
            className="absolute inset-x-0 top-1/2"
            style={{
              height: slotHeight,
              marginTop: -slotHeight / 2,
              zIndex: s.zIndex,
              // Invisible (overscan) slots must not catch clicks.
              pointerEvents: s.opacity === 0 ? 'none' : undefined,
            }}
            initial={{ x: enter.x, y: enter.y, scale: enter.scale, opacity: 0 }}
            animate={{ x: s.x, y: s.y, scale: s.scale, opacity: s.opacity }}
            transition={carouselSlide}
            onClick={() => {
              if (focused) return;
              if (index === focusIndex) {
                // Another copy of the focused item: move the wheel to the clicked copy.
                setVirtual(k);
              } else {
                setPending({ k, from: focusIndex });
                onFocusChange(index);
              }
            }}
            onDoubleClick={() => {
              onActivate(index);
            }}
          >
            {renderItem({ item: items[index] as T, index, focused, distance: d })}
          </motion.div>
        );
      })}
    </div>
  );
}
