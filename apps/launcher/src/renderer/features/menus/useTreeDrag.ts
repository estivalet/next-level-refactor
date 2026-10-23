import type { MenuDocNode } from '@nextlevel/shared';
import { useRef, useState, type DragEvent } from 'react';
import { dropTarget, dropZoneAt, type DropZone, type Row } from './rows.ts';
import { findNode } from './treeOps.ts';

/**
 * Native drag and drop between tree rows (FR-MENU-1): upper third before, lower third after,
 * middle inside (categories only). Drops into the dragged node itself or below it are refused.
 */
export function useTreeDrag(
  nodes: readonly MenuDocNode[],
  onMove: (id: string, toParentId: string | null, toIndex: number) => void,
) {
  const dragged = useRef<string | null>(null);
  const [indicator, setIndicator] = useState<{ id: string; zone: DropZone } | null>(null);

  const zoneFor = (event: DragEvent<HTMLElement>, row: Row): DropZone | null => {
    const from = dragged.current;
    if (from === null) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const zone = dropZoneAt(event.clientY - rect.top, rect.height, row.node.type === 'category');
    const landing = zone === 'inside' ? row.node.id : row.parentId;
    if (landing === null) return zone;
    const node = findNode(nodes, from);
    return landing === from || (node && findNode(node.children, landing)) ? null : zone;
  };

  const handlers = (row: Row) => ({
    onDragStart: (event: DragEvent<HTMLElement>) => {
      dragged.current = row.node.id;
      event.dataTransfer.setData('text/plain', row.node.id);
      event.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      const zone = zoneFor(event, row);
      if (!zone) {
        setIndicator(null);
        return;
      }
      event.preventDefault();
      if (indicator?.id !== row.node.id || indicator.zone !== zone) {
        setIndicator({ id: row.node.id, zone });
      }
    },
    onDragLeave: () => {
      if (indicator?.id === row.node.id) setIndicator(null);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      const zone = zoneFor(event, row);
      const from = dragged.current;
      dragged.current = null;
      setIndicator(null);
      if (!zone || from === null) return;
      event.preventDefault();
      const { toParentId, toIndex } = dropTarget(row, zone);
      onMove(from, toParentId, toIndex);
    },
    onDragEnd: () => {
      dragged.current = null;
      setIndicator(null);
    },
  });

  return { handlers, indicatorFor: (id: string) => (indicator?.id === id ? indicator.zone : null) };
}
