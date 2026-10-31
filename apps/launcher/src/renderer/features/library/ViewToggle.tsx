import { LayoutGrid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ViewMode } from './useViewMode.ts';

/** Grid or list (D61, D62); `gridDisabled` when only the list can show the games. */
export function ViewToggle({
  view,
  onView,
  gridDisabled = false,
}: {
  view: ViewMode;
  onView: (view: ViewMode) => void;
  gridDisabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 rounded-lg bg-white/5 p-0.5">
      {(['grid', 'list'] as const).map((mode) => {
        const Icon = mode === 'grid' ? LayoutGrid : List;
        return (
          <button
            key={mode}
            type="button"
            aria-label={t(`library.view.${mode}`)}
            aria-pressed={view === mode}
            disabled={mode === 'grid' && gridDisabled}
            className={`rounded-md p-1.5 disabled:opacity-30 ${view === mode ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
            onClick={() => {
              onView(mode);
            }}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
