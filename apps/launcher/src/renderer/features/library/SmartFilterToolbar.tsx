import type { SmartFilterSummary } from '@nextlevel/shared';
import { Pencil, Sparkles, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const BUTTON =
  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 hover:bg-white/5 hover:text-white';

/** Above a smart filter's list (FR-LIB-9): its name, Edit… and Delete. */
export function SmartFilterToolbar({
  filter,
  onEdit,
  onDelete,
}: {
  filter: SmartFilterSummary;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="toolbar"
      aria-label={t('library.smart.toolbar')}
      className="flex shrink-0 items-center gap-1 border-b border-white/5 px-3 py-2"
    >
      <span className="mr-2 truncate text-sm font-semibold text-white">{filter.name}</span>
      <span className="flex-1" />
      <button type="button" className={BUTTON} onClick={onEdit}>
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
        {t('library.smart.edit')}
      </button>
      <button
        type="button"
        className={BUTTON}
        aria-label={t('library.smart.deleteTitle')}
        onClick={onDelete}
      >
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        {t('library.smart.delete')}
      </button>
    </div>
  );
}

/** Matches the Library home's header tools (Health). */
const NEW_BUTTON =
  'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-white';

/** "New smart filter" in the Library home's Collections header; sparkles match its cards. */
export function NewSmartFilterButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={NEW_BUTTON}
    >
      <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
      {t('library.smart.new')}
    </button>
  );
}
