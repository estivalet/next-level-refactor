import { useRef, useState, type DragEvent } from 'react';
import type { PagedGames } from './usePagedGames.ts';

/** What a list needs to let rows be dragged into a new order (FR-LIB-8, D11). */
export interface RowReorder {
  /** The games a drag from this row moves, in list order: the selection when it holds the row. */
  blockFor: (index: number) => number[];
  /** Puts the games right before `beforeGameId` (null = the end). */
  onMove: (gameIds: number[], beforeGameId: number | null) => void;
}

export interface RowDragProps {
  draggable: true;
  indicator: 'before' | 'after' | null;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

/** Upper half of a row = before it, lower half = before the next row (or the end). */
export function useRowDrag(reorder: RowReorder | undefined, games: PagedGames) {
  const dragged = useRef<number[] | null>(null);
  const [indicator, setIndicator] = useState<{ index: number; zone: 'before' | 'after' } | null>(
    null,
  );
  const zoneAt = (event: DragEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return rect.height > 0 && event.clientY - rect.top > rect.height / 2 ? 'after' : 'before';
  };
  /** The game the block goes before; undefined when that row isn't loaded or is in the block. */
  const anchor = (index: number, zone: 'before' | 'after'): number | null | undefined => {
    const at = zone === 'before' ? index : index + 1;
    if (games.total !== null && at >= games.total) return null;
    const id = games.rowAt(at)?.id;
    return id === undefined || dragged.current?.includes(id) ? undefined : id;
  };
  const end = () => {
    dragged.current = null;
    setIndicator(null);
  };
  return (index: number): RowDragProps | undefined => {
    if (!reorder) return undefined;
    return {
      draggable: true,
      indicator: indicator?.index === index ? indicator.zone : null,
      onDragStart: (event) => {
        dragged.current = reorder.blockFor(index);
        event.dataTransfer.setData('text/plain', dragged.current.join(','));
        event.dataTransfer.effectAllowed = 'move';
      },
      onDragOver: (event) => {
        if (!dragged.current) return;
        const zone = zoneAt(event);
        if (anchor(index, zone) === undefined) return;
        event.preventDefault();
        if (indicator?.index !== index || indicator.zone !== zone) setIndicator({ index, zone });
      },
      onDragLeave: () => {
        if (indicator?.index === index) setIndicator(null);
      },
      onDrop: (event) => {
        const block = dragged.current;
        const target = block ? anchor(index, zoneAt(event)) : undefined;
        end();
        if (!block || target === undefined) return;
        event.preventDefault();
        reorder.onMove(block, target);
      },
      onDragEnd: end,
    };
  };
}
