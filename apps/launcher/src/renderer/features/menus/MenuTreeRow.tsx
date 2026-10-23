import type { MenuDocNode } from '@nextlevel/shared';
import { ChevronRight, Eye, EyeOff, Folder, Gamepad2, LibraryBig, Sparkles } from 'lucide-react';
import { useRef, useState, type DragEvent, type ElementType } from 'react';
import { useTranslation } from 'react-i18next';
import type { DropZone, Row } from './rows.ts';

const KIND_ICON: Record<MenuDocNode['type'], ElementType> = {
  category: Folder,
  system: Gamepad2,
  collection: LibraryBig,
  smartFilter: Sparkles,
};

/** What the tree shows for a node: its display name, else its name. */
export const nodeLabel = (node: MenuDocNode) => node.displayName ?? node.name;

export interface MenuTreeRowProps {
  row: Row;
  top: number;
  height: number;
  selected: boolean;
  renaming: boolean;
  /** Why the node can't open in themes (greyed), if it can't. */
  status: string | null;
  indicator: DropZone | null;
  onSelect: () => void;
  onToggle: () => void;
  onToggleVisible: () => void;
  onRename: (label: string | null) => void;
  drag: {
    onDragStart: (event: DragEvent<HTMLElement>) => void;
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
    onDragEnd: () => void;
  };
}

const ICON_BUTTON = 'rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-white';

export function MenuTreeRow(props: MenuTreeRowProps) {
  const { row, selected, renaming, status, indicator } = props;
  const { t } = useTranslation();
  const { node } = row;
  const label = nodeLabel(node);
  const Icon = KIND_ICON[node.type];
  const dimmed = !node.visible || row.hiddenByAncestor || status !== null;
  return (
    <div
      id={`menu-node-${node.id}`}
      role="treeitem"
      aria-label={label}
      aria-level={row.depth + 1}
      aria-selected={selected}
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      draggable={!renaming}
      {...props.drag}
      onClick={props.onSelect}
      title={status ?? undefined}
      style={{ top: props.top, height: props.height, paddingLeft: 8 + row.depth * 16 }}
      className={`absolute inset-x-0 flex items-center gap-2 pr-2 text-xs ${
        selected ? 'bg-emerald-500/20 text-white' : 'text-slate-300 hover:bg-white/5'
      } ${dimmed ? 'opacity-50' : ''} ${
        indicator === 'before' ? 'border-t-2 border-emerald-400' : ''
      } ${indicator === 'after' ? 'border-b-2 border-emerald-400' : ''} ${
        indicator === 'inside' ? 'ring-1 ring-emerald-400 ring-inset' : ''
      }`}
    >
      {row.hasChildren ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={t(row.expanded ? 'menuEditor.tree.collapse' : 'menuEditor.tree.expand', {
            name: label,
          })}
          className={ICON_BUTTON}
          onClick={(event) => {
            event.stopPropagation();
            props.onToggle();
          }}
        >
          <ChevronRight
            aria-hidden="true"
            className={`h-3.5 w-3.5 transition-transform ${row.expanded ? 'rotate-90' : ''}`}
          />
        </button>
      ) : (
        <span className="w-[18px]" />
      )}
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      {renaming ? (
        <RenameInput initial={label} onDone={props.onRename} />
      ) : (
        <span className={`truncate ${node.visible ? '' : 'line-through'}`}>{label}</span>
      )}
      <span className="text-[9px] tracking-wider text-slate-500 uppercase">
        {t(`menuEditor.kind.${node.type}`)}
      </span>
      {status && <span className="truncate text-[10px] text-amber-300/80">{status}</span>}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t(node.visible ? 'menuEditor.tree.hide' : 'menuEditor.tree.show', {
          name: label,
        })}
        className={`${ICON_BUTTON} ml-auto`}
        onClick={(event) => {
          event.stopPropagation();
          props.onToggleVisible();
        }}
      >
        {node.visible ? (
          <Eye aria-hidden="true" className="h-3.5 w-3.5" />
        ) : (
          <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

/** Enter or leaving keeps the text (empty = no change), Escape cancels; reports once. */
function RenameInput({
  initial,
  onDone,
}: {
  initial: string;
  onDone: (label: string | null) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (label: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(label);
  };
  const typed = () => (value.trim() === '' ? null : value.trim());
  return (
    <input
      autoFocus
      aria-label={t('menuEditor.tree.renameLabel')}
      value={value}
      maxLength={200}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onChange={(event) => {
        setValue(event.target.value);
      }}
      onBlur={() => {
        finish(typed());
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') finish(typed());
        else if (event.key === 'Escape') finish(null);
      }}
      className="min-w-0 flex-1 rounded border border-emerald-500/50 bg-black/60 px-1 text-xs text-white focus:outline-none"
    />
  );
}
