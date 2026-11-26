import type { GameScope } from '@nextlevel/shared';
import { useMutation } from '@tanstack/react-query';
import { FileDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getBridge } from '../../bridge.ts';
import { unwrap } from '../settings/settingsApi.ts';

/**
 * Above a Delete later tab with games: the count and Export cleanup script… (FR-LIB-20, US-C14).
 * The launcher only writes the script; the owner reviews and runs it.
 */
export function DeleteLaterBar(props: { scope: GameScope; title: string; count: number }) {
  const { scope, title, count } = props;
  const { t } = useTranslation();
  const exporting = useMutation({
    mutationFn: async () =>
      unwrap(await getBridge().invoke('library.exportCleanupScript', { scope, title })),
  });
  const saved = exporting.data?.status === 'saved' ? exporting.data : null;
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-3 py-2">
      <span className="flex-1 text-[11px] text-slate-500" role="status">
        {saved
          ? t('library.cleanup.saved', { games: saved.games, files: saved.files })
          : exporting.isError
            ? t('library.cleanup.failed')
            : t('library.cleanup.count', { count })}
      </span>
      <button
        type="button"
        disabled={exporting.isPending}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
        onClick={() => {
          exporting.mutate();
        }}
      >
        <FileDown aria-hidden="true" className="h-3.5 w-3.5" />
        {t('library.cleanup.export')}
      </button>
    </div>
  );
}
