import { COLLECTION_SORTS, type CollectionSort, type CollectionSummary } from '@nextlevel/shared';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useReorderCollection, useUpdateCollection } from './collectionsApi.ts';

const BUTTON =
  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30';

interface CollectionToolbarProps {
  collection: CollectionSummary;
  /** The focused row and its game, for Move up / Move down. */
  focused: { index: number; gameId: number } | null;
  total: number;
  onMoved: (index: number) => void;
  onRename: () => void;
  onDelete: () => void;
}

/** Above a collection's list (FR-LIB-8): its order, manual moves, rename and delete. */
export function CollectionToolbar(props: CollectionToolbarProps) {
  const { t } = useTranslation();
  const update = useUpdateCollection();
  const reorder = useReorderCollection();
  const { collection, focused } = props;
  const manual = collection.sort === 'manual';
  const move = (step: number) => {
    if (!focused) return;
    const position = focused.index + step;
    reorder.mutate({ id: collection.id, gameId: focused.gameId, position });
    props.onMoved(position);
  };
  return (
    <div
      role="toolbar"
      aria-label={t('library.collections.toolbar')}
      className="flex shrink-0 items-center gap-1 border-b border-white/5 px-3 py-2"
    >
      <span className="mr-2 truncate text-sm font-semibold text-white">{collection.name}</span>
      <label className="flex items-center gap-2 text-[11px] text-slate-500">
        {t('library.sort.label')}
        <select
          value={collection.sort}
          onChange={(event) => {
            update.mutate({ id: collection.id, sort: event.target.value as CollectionSort });
          }}
          className="rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-xs text-slate-300"
        >
          {COLLECTION_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {t(`library.sort.${sort}`)}
            </option>
          ))}
        </select>
      </label>
      {manual && (
        <>
          <button
            type="button"
            className={BUTTON}
            disabled={!focused || focused.index === 0 || reorder.isPending}
            onClick={() => {
              move(-1);
            }}
          >
            <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
            {t('library.collections.moveUp')}
          </button>
          <button
            type="button"
            className={BUTTON}
            disabled={!focused || focused.index >= props.total - 1 || reorder.isPending}
            onClick={() => {
              move(1);
            }}
          >
            <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
            {t('library.collections.moveDown')}
          </button>
        </>
      )}
      <span className="flex-1" />
      <button type="button" className={BUTTON} onClick={props.onRename}>
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
        {t('library.collections.rename')}
      </button>
      <button type="button" className={BUTTON} onClick={props.onDelete}>
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        {t('library.collections.delete')}
      </button>
    </div>
  );
}

/** The "+" in the tree's Collections header. */
export function NewCollectionButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-label={t('library.collections.new')}
      title={t('library.collections.new')}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-emerald-400"
    >
      <Plus aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  );
}
