import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, type ReactNode } from 'react';

/**
 * A virtualized list of fixed-height rows (coding standards: lists over 100 items). The box grows
 * with the rows up to `maxHeight`, then scrolls.
 */
export function VirtualRows<T>({
  items,
  label,
  rowHeight,
  maxHeight,
  getKey,
  renderRow,
}: {
  items: readonly T[];
  label: string;
  rowHeight: number;
  maxHeight: number;
  getKey: (item: T) => string;
  renderRow: (item: T) => ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns functions that can't be auto-memoized; nothing here relies on the
  // React Compiler, so its "incompatible library" notice doesn't apply.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => rowHeight,
    overscan: 8,
    initialRect: { width: 640, height: maxHeight },
  });
  return (
    <div
      ref={scroller}
      className="overflow-y-auto"
      style={{ height: Math.min(items.length * rowHeight, maxHeight) }}
    >
      <ul aria-label={label} className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index];
          if (item === undefined) return null;
          return (
            <li
              key={getKey(item)}
              className="absolute inset-x-0 flex items-center"
              style={{ top: row.start, height: rowHeight }}
            >
              {renderRow(item)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
