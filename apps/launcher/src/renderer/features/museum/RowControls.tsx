import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const BUTTON =
  'rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent';

/** Move up, move down and remove for one row of a list editor. */
export function RowControls({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 gap-1">
      <button
        type="button"
        className={BUTTON}
        aria-label={t('apps.museum.moveUp')}
        disabled={index === 0}
        onClick={() => {
          onMove(-1);
        }}
      >
        <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={BUTTON}
        aria-label={t('apps.museum.moveDown')}
        disabled={index === count - 1}
        onClick={() => {
          onMove(1);
        }}
      >
        <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={BUTTON}
        aria-label={t('apps.museum.remove')}
        onClick={onRemove}
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
