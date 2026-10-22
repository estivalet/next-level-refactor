import type { MenuDocNode } from '@nextlevel/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT } from '../library/Modal.tsx';
import { MenuTreeRow } from './MenuTreeRow.tsx';
import { buildRows } from './rows.ts';
import {
  ancestorIds,
  findNode,
  indent,
  moveDown,
  moveNode,
  moveUp,
  outdent,
  updateNode,
  type MoveResult,
} from './treeOps.ts';
import { useTreeDrag } from './useTreeDrag.ts';

const ROW_HEIGHT = 28;

export interface MenuTreeViewProps {
  nodes: MenuDocNode[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (nodes: MenuDocNode[]) => void;
  onDelete: (id: string) => void;
  /** Why a node can't open in themes (FR-MENU-2), or null. */
  statusOf?: (node: MenuDocNode) => string | null;
}

/**
 * The menu as a virtualized tree (S10): arrows select, Alt+arrows move and indent, F2 renames,
 * Delete asks, drag and drop moves; the search box keeps matches and their categories.
 */
export function MenuTreeView({
  nodes,
  selectedId,
  onSelect,
  onChange,
  onDelete,
  statusOf,
}: MenuTreeViewProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => buildRows(nodes, expanded, query), [nodes, expanded, query]);
  const selectedIndex = rows.findIndex((row) => row.node.id === selectedId);

  // A selected node moved into a collapsed category stays in view.
  useEffect(() => {
    if (selectedId === null) return;
    const above = ancestorIds(nodes, selectedId);
    setExpanded((prev) =>
      above.every((id) => prev.has(id)) ? prev : new Set([...prev, ...above]),
    );
  }, [nodes, selectedId]);

  // eslint-disable-next-line react-hooks/incompatible-library -- see GameList: no React Compiler here.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    initialRect: { width: 480, height: 480 },
  });
  const drag = useTreeDrag(nodes, (id, toParentId, toIndex) => {
    commit(moveNode(nodes, id, toParentId, toIndex));
  });

  const commit = (result: MoveResult) => {
    if (result.changed) onChange(result.nodes);
  };
  const toggle = (id: string, open?: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const selectAt = (index: number) => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!row) return;
    onSelect(row.node.id);
    virtualizer.scrollToIndex(rows.indexOf(row));
  };
  const rename = (id: string, label: string | null) => {
    setRenaming(null);
    const node = findNode(nodes, id);
    if (!node || label === null) return;
    const patch = node.type === 'category' ? { name: label } : { displayName: label };
    onChange(updateNode(nodes, id, patch));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const row = rows[selectedIndex];
    const id = row?.node.id;
    if (event.altKey && id !== undefined) {
      const moves: Record<string, typeof moveUp> = {
        ArrowUp: moveUp,
        ArrowDown: moveDown,
        ArrowRight: indent,
        ArrowLeft: outdent,
      };
      const move = moves[event.key];
      if (!move) return;
      commit(move(nodes, id));
    } else if (event.key === 'ArrowDown') selectAt(selectedIndex + 1);
    else if (event.key === 'ArrowUp') selectAt(selectedIndex < 0 ? 0 : selectedIndex - 1);
    else if (event.key === 'ArrowRight' && row?.hasChildren) toggle(row.node.id, true);
    else if (event.key === 'ArrowLeft' && row) {
      if (row.expanded) toggle(row.node.id, false);
      else if (row.parentId !== null) onSelect(row.parentId);
    } else if (event.key === 'F2' && id !== undefined) setRenaming(id);
    else if (event.key === 'Delete' && id !== undefined) onDelete(id);
    else return;
    event.preventDefault();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <label className="flex items-center gap-2 border-b border-white/5 p-2">
        <Search aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" />
        <input
          type="search"
          aria-label={t('menuEditor.tree.search')}
          placeholder={t('menuEditor.tree.search')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          className={INPUT}
        />
      </label>
      {nodes.length === 0 && (
        <p className="p-4 text-xs text-slate-500">{t('menuEditor.tree.empty')}</p>
      )}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div
          role="tree"
          tabIndex={0}
          aria-label={t('menuEditor.tree.label')}
          aria-activedescendant={selectedId === null ? undefined : `menu-node-${selectedId}`}
          onKeyDown={onKeyDown}
          className="relative focus-visible:outline-none"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            const id = row.node.id;
            return (
              <MenuTreeRow
                key={id}
                row={row}
                top={item.start}
                height={ROW_HEIGHT}
                selected={id === selectedId}
                renaming={id === renaming}
                status={statusOf?.(row.node) ?? null}
                indicator={drag.indicatorFor(id)}
                drag={drag.handlers(row)}
                onSelect={() => {
                  onSelect(id);
                }}
                onToggle={() => {
                  toggle(id);
                }}
                onToggleVisible={() => {
                  onChange(updateNode(nodes, id, { visible: !row.node.visible }));
                }}
                onRename={(label) => {
                  rename(id, label);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
