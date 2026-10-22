// Ported from NextLevelOS src/themes/components/Carousel.tsx @ 3d530b7. Mouse (FR-THM-3): a click
// focuses an item, a double-click activates it, the wheel moves focus one step.
import { motion } from 'motion/react';
import { useMemo, useRef, useState, type WheelEvent as ReactWheelEvent } from 'react';
import { carouselSlide } from '../engine/transitions.ts';
import type { CarouselRenderItem } from '../engine/types.ts';
import { cn } from './cn.ts';

interface CarouselProps<T> {
  items: readonly T[];
  /** Controlled index of the centered item. */
  focusIndex: number;
  onFocusChange: (index: number) => void;
  onActivate: (index: number) => void;
  renderItem: CarouselRenderItem<T>;
  /** Wrap data indices past the ends. Default true. */
  loop?: boolean;
  /** How many slots to mount on each side of the focused one. Default 6. */
  visibleRadius?: number;
  /** Fixed slot width in px, used for layout math. */
  itemWidth: number;
  /** Gap between slots in px. Default 16. */
  gap?: number;
  className?: string;
  /** `motion` transition for the track. Default `carouselSlide`. */
  transition?: object;
}

const WHEEL_DEBOUNCE_MS = 80;

function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}

/**
 * Signed number of single steps from `from` to `to` around a ring of `n`, the shorter way (ties
 * go forward). Wrapping from the last item to the first is `+1`, which keeps the track from
 * rewinding across its whole width on an edge wrap.
 */
export function shortestDelta(from: number, to: number, n: number): number {
  if (n <= 0) return 0;
  let d = (((to - from) % n) + n) % n;
  if (d * 2 > n) d -= n;
  return d;
}

export function Carousel<T>({
  items,
  focusIndex,
  onFocusChange,
  onActivate,
  renderItem,
  loop = true,
  visibleRadius = 6,
  itemWidth,
  gap = 16,
  className,
  transition = carouselSlide,
}: CarouselProps<T>) {
  const n = items.length;
  const wheelAt = useRef(0);

  // The track lives in an unwrapped coordinate space, so looping past an end moves one step
  // instead of jumping back to 0. Each focus change becomes the shortest ring delta.
  const [virtual, setVirtual] = useState(focusIndex);
  const [prevFocus, setPrevFocus] = useState(focusIndex);
  const [prevN, setPrevN] = useState(n);

  if (n > 0 && n !== prevN) {
    // A new list (another level, a search): resync to the prop.
    setPrevN(n);
    setPrevFocus(focusIndex);
    setVirtual(focusIndex);
  } else if (n > 0 && focusIndex !== prevFocus) {
    const delta = loop ? shortestDelta(prevFocus, focusIndex, n) : focusIndex - prevFocus;
    setPrevFocus(focusIndex);
    setVirtual((v) => v + delta);
  }

  const slots = useMemo(() => {
    const out: { key: number; dataIndex: number; offset: number }[] = [];
    for (let offset = -visibleRadius; offset <= visibleRadius; offset++) {
      const raw = virtual + offset;
      const dataIndex = loop ? wrap(raw, n) : raw;
      if (dataIndex < 0 || dataIndex >= n) continue;
      out.push({ key: raw, dataIndex, offset });
    }
    return out;
  }, [virtual, visibleRadius, loop, n]);

  if (n === 0) return <div className={className} />;

  const step = itemWidth + gap;

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - wheelAt.current < WHEEL_DEBOUNCE_MS) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;
    wheelAt.current = now;
    const dir = delta > 0 ? 1 : -1;
    const next = loop ? wrap(focusIndex + dir, n) : Math.max(0, Math.min(n - 1, focusIndex + dir));
    if (next !== focusIndex) onFocusChange(next);
  };

  return (
    <div className={cn('relative overflow-hidden', className)} onWheel={onWheel}>
      <motion.div
        className="absolute top-0 h-full"
        style={{ left: '50%', marginLeft: -itemWidth / 2 }}
        animate={{ x: -(virtual * step) }}
        transition={transition}
      >
        {slots.map(({ key, dataIndex, offset }) => {
          const focused = offset === 0;
          const item = items[dataIndex] as T;
          return (
            <div
              key={key}
              className="absolute top-0 h-full"
              style={{
                width: itemWidth,
                transform: `translateX(${String(key * step)}px)`,
                // The focused slot sits above its neighbours so a scaled-up item overlaps them.
                zIndex: focused ? 2 : 1,
              }}
              onClick={() => {
                if (!focused) onFocusChange(dataIndex);
              }}
              onDoubleClick={() => {
                onActivate(dataIndex);
              }}
            >
              {renderItem({ item, index: dataIndex, focused, offset })}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
