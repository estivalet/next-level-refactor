import type { GameScope } from '@nextlevel/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight, Folder, Gamepad2, Sparkles } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { OTHER_GROUP, type TreeRow } from './buildTree.ts';

const ROW_HEIGHT = 32;

const HEADERS = new Set<TreeRow['kind']>(['group', 'collectionsHeader', 'smartFiltersHeader']);

function isScope(row: TreeRow, scope: GameScope | null): boolean {
  if (!scope) return false;
  if (row.kind === 'system') return scope.kind === 'system' && scope.systemId === row.systemId;
  if (row.kind === 'collection') {
    return scope.kind === 'collection' && scope.collectionId === row.collection.id;
  }
  if (row.kind === 'smartFilter') {
    return scope.kind === 'smartFilter' && scope.smartFilterId === row.filter.id;
  }
  return false;
}

interface SystemTreeProps {
  rows: readonly TreeRow[];
  scope: GameScope | null;
  onSelectScope: (scope: GameScope) => void;
  onToggleGroup: (key: string) => void;
  /** Extra controls in the collections header (New collection). */
  collectionsAction?: ReactNode;
  /** Extra controls in the smart filters header (New smart filter, FR-LIB-9). */
  smartFiltersAction?: ReactNode;
}

/** The Library's virtualized left tree: manufacturer groups, systems with counts, collections. */
export function SystemTree({
  rows,
  scope,
  onSelectScope,
  onToggleGroup,
  collectionsAction,
  smartFiltersAction,
}: SystemTreeProps) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);
  // TanStack Virtual returns functions that can't be auto-memoized; nothing here relies on the
  // React Compiler, so its "incompatible library" notice doesn't apply.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    initialRect: { width: 256, height: 480 },
  });
  const selectedIndex = rows.findIndex((row) => isScope(row, scope));
  const activeIndex = active >= 0 && active < rows.length ? active : selectedIndex;

  const activate = (row: TreeRow | undefined) => {
    if (row?.kind === 'group') onToggleGroup(row.key);
    if (row?.kind === 'system') onSelectScope({ kind: 'system', systemId: row.systemId });
    if (row?.kind === 'collection') {
      onSelectScope({ kind: 'collection', collectionId: row.collection.id });
    }
    if (row?.kind === 'smartFilter') {
      onSelectScope({ kind: 'smartFilter', smartFilterId: row.filter.id });
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
    const step = moves[event.key];
    if (step !== undefined) {
      event.preventDefault();
      const next = Math.min(rows.length - 1, Math.max(0, activeIndex + step));
      setActive(next);
      virtualizer.scrollToIndex(next);
      return;
    }
    const row = rows[activeIndex];
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate(row);
    } else if (
      row?.kind === 'group' &&
      ((event.key === 'ArrowLeft' && row.expanded) || (event.key === 'ArrowRight' && !row.expanded))
    ) {
      onToggleGroup(row.key);
    }
  };

  return (
    <div ref={scroller} className="flex-1 overflow-y-auto py-2">
      <div
        role="tree"
        tabIndex={0}
        aria-label={t('library.tree.label')}
        aria-activedescendant={activeIndex >= 0 ? `library-tree-${String(activeIndex)}` : undefined}
        onKeyDown={onKeyDown}
        className="relative focus-visible:outline-none"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index];
          if (!row) return null;
          const selected = isScope(row, scope);
          const focused = item.index === activeIndex;
          return (
            <div
              key={item.key}
              id={`library-tree-${String(item.index)}`}
              role="treeitem"
              aria-level={HEADERS.has(row.kind) ? 1 : 2}
              aria-selected={HEADERS.has(row.kind) ? undefined : selected}
              aria-expanded={row.kind === 'group' ? row.expanded : undefined}
              onClick={() => {
                setActive(item.index);
                activate(row);
              }}
              className={`absolute left-0 flex w-full items-center gap-2 px-3 text-xs ${
                selected
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              } ${focused ? 'ring-1 ring-white/30 ring-inset' : ''}`}
              style={{ top: item.start, height: ROW_HEIGHT }}
            >
              <TreeRowContent
                row={row}
                action={row.kind === 'smartFiltersHeader' ? smartFiltersAction : collectionsAction}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TreeRowContent({ row, action }: { row: TreeRow; action: ReactNode }) {
  const { t } = useTranslation();
  if (row.kind === 'group') {
    const Chevron = row.expanded ? ChevronDown : ChevronRight;
    return (
      <>
        <Chevron aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-[10px] font-medium tracking-wider uppercase">
          {row.label === OTHER_GROUP ? t('library.tree.other') : row.label}
        </span>
      </>
    );
  }
  if (row.kind === 'collectionsHeader' || row.kind === 'smartFiltersHeader') {
    return (
      <>
        <span className="flex-1 truncate text-[10px] font-medium tracking-wider uppercase">
          {t(row.kind === 'collectionsHeader' ? 'library.tree.collections' : 'library.tree.smart')}
        </span>
        {action}
      </>
    );
  }
  const [Icon, label, count] =
    row.kind === 'system'
      ? [Gamepad2, row.label, row.games]
      : row.kind === 'smartFilter'
        ? [Sparkles, row.filter.name, row.filter.games]
        : [Folder, row.collection.name, row.collection.games];
  return (
    <>
      <Icon aria-hidden="true" className="ml-3 h-3.5 w-3.5 shrink-0 text-slate-600" />
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono text-[10px] text-slate-500">{count.toLocaleString()}</span>
    </>
  );
}
