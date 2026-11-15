import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { SECONDARY_BUTTON } from '../library/Modal.tsx';
import { moveItem, removeAt, replaceAt } from './listOps.ts';
import { RowControls } from './RowControls.tsx';

/** An ordered list with add, remove and move up/down; the caller draws each row's fields. */
export function ListEditor<T>({
  items,
  onChange,
  makeNew,
  addLabel,
  listLabel,
  renderRow,
}: {
  items: readonly T[];
  onChange: (items: T[]) => void;
  makeNew: () => T;
  addLabel: string;
  listLabel: string;
  renderRow: (item: T, index: number, update: (item: T) => void) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <ul aria-label={listLabel} className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li
              // Rows have no stable id and are edited in place, so the position is the identity.
              key={index}
              className="flex items-start gap-2 rounded-lg border border-white/10 p-2"
            >
              <div className="min-w-0 flex-1">
                {renderRow(item, index, (next) => {
                  onChange(replaceAt(items, index, next));
                })}
              </div>
              <RowControls
                index={index}
                count={items.length}
                onMove={(delta) => {
                  onChange(moveItem(items, index, delta));
                }}
                onRemove={() => {
                  onChange(removeAt(items, index));
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className={`${SECONDARY_BUTTON} flex w-fit items-center gap-1`}
        onClick={() => {
          onChange([...items, makeNew()]);
        }}
      >
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        {addLabel}
      </button>
    </div>
  );
}
