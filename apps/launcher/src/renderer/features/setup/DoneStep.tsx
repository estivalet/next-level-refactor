import { useTranslation } from 'react-i18next';
import { useSystemSummaries } from '../library/libraryApi.ts';
import { NEXT_BUTTON, type StepProps } from './stepProps.ts';

/**
 * Step 5 (FR-ONB-1, FR-ONB-2): finishing marks setup complete. With games, **Start** (the boot
 * target); with none, **Browse catalog**, which opens the Catalog on its Starter set.
 */
export function DoneStep({
  finish,
}: Pick<StepProps, 'settings'> & { finish: (landing: 'catalog' | null) => void }) {
  const { t } = useTranslation();
  const summaries = useSystemSummaries();
  const games = (summaries.data ?? []).reduce((sum, row) => sum + row.games, 0);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-300">
        {games > 0 ? t('setup.done.withGames', { count: games }) : t('setup.done.empty')}
      </p>
      <div>
        <button
          type="button"
          className={NEXT_BUTTON}
          disabled={!summaries.isFetched}
          onClick={() => {
            finish(games > 0 ? null : 'catalog');
          }}
        >
          {games > 0 ? t('setup.done.start') : t('setup.done.browse')}
        </button>
      </div>
    </div>
  );
}
