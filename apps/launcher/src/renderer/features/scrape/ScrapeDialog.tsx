import type {
  GameDetails,
  ScrapeApplyResult,
  ScrapePreview,
  ScrapeProvider,
} from '@nextlevel/shared';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameDetails } from '../library/libraryApi.ts';
import { INPUT, Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../library/Modal.tsx';
import { errorMessageKey } from '../settings/settingsApi.ts';
import { CandidateList } from './CandidateList.tsx';
import { defaultPicks, selectionOf, type Picks } from './picks.ts';
import { PreviewTable } from './PreviewTable.tsx';
import { scrapeKey } from './providerText.ts';
import { providerInput, useApplyScrape } from './scrapeApi.ts';
import { SystemPicker } from './SystemPicker.tsx';
import { useScrape } from './useScrape.ts';

/**
 * Scrape… (S7, FR-SCR-1, US-C5): pick a candidate from ScreenScraper or LaunchBox (FR-SCR-6),
 * tick the art and fields to take, apply. Opens once the game is loaded (normally cached by the
 * details panel). Try LaunchBox switches a ScreenScraper dialog that found nothing.
 */
export function ScrapeDialog(props: {
  gameId: number;
  provider?: ScrapeProvider;
  onClose: () => void;
}) {
  const details = useGameDetails(props.gameId);
  const [source, setSource] = useState<ScrapeProvider>(props.provider ?? 'screenscraper');
  return details.data ? (
    <ScrapeForm
      key={source}
      game={details.data}
      provider={source}
      onTryLaunchBox={() => {
        setSource('launchbox');
      }}
      onClose={props.onClose}
    />
  ) : null;
}

function Busy({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-xs text-slate-400">
      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      {label}
    </p>
  );
}

function ScrapeForm(props: {
  game: GameDetails;
  provider: ScrapeProvider;
  onTryLaunchBox: () => void;
  onClose: () => void;
}) {
  const { game, provider, onClose } = props;
  const { t } = useTranslation();
  const key = (name: string) => scrapeKey(provider, name);
  const { state, search, preview, saveSystem, download, reloadSystems } = useScrape(game, provider);
  const apply = useApplyScrape();
  const [query, setQuery] = useState(game.title);
  const [overwrite, setOverwrite] = useState(false);
  const [picks, setPicks] = useState<Picks>({});
  const [failed, setFailed] = useState<ScrapeApplyResult['failed']>([]);
  // A new preview (another candidate) starts from its own defaults; adjusted during render.
  const [picksFor, setPicksFor] = useState<ScrapePreview | null>(null);
  if (picksFor !== state.preview) {
    setPicksFor(state.preview);
    setOverwrite(false);
    setFailed([]);
    setPicks(state.preview ? defaultPicks(state.preview, false) : {});
  }

  const selection = selectionOf(picks);
  const nothingPicked = selection.kinds.length === 0 && selection.fields.length === 0;
  const run = () => {
    if (state.selectedId === null) return;
    setFailed([]);
    apply.mutate(
      {
        gameId: game.id,
        providerGameId: state.selectedId,
        ...selection,
        ...providerInput(provider),
      },
      {
        onSuccess: (result) => {
          if (result.failed.length > 0) setFailed(result.failed);
          else onClose();
        },
      },
    );
  };
  const errorKey = apply.error ? errorMessageKey(apply.error) : state.errorKey;

  return (
    <Modal
      title={t(key('title'), { title: game.title })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('library.scrape.close')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={!state.preview || nothingPicked || apply.isPending}
            onClick={run}
          >
            {t(apply.isPending ? 'library.scrape.applying' : 'library.scrape.apply')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim()) void search(query.trim());
          }}
        >
          <input
            type="text"
            aria-label={t('library.scrape.searchLabel')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            className={INPUT}
          />
          <button type="submit" className={`${SECONDARY_BUTTON} shrink-0`}>
            {t('library.scrape.search')}
          </button>
        </form>
        {state.phase === 'searching' && <Busy label={t(key('searching'))} />}
        {state.phase === 'needsSystem' && (
          <SystemPicker
            provider={provider}
            options={state.systems}
            onSave={saveSystem}
            onReload={reloadSystems}
          />
        )}
        {state.phase === 'needsDownload' && (
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <p className="flex-1">{t('library.scrape.lb.needsDownload')}</p>
            {state.downloading ? (
              <Busy label={t('library.scrape.lb.downloading')} />
            ) : (
              <button
                type="button"
                className={`${PRIMARY_BUTTON} shrink-0`}
                onClick={() => void download()}
              >
                {t('library.scrape.lb.download')}
              </button>
            )}
          </div>
        )}
        {state.phase === 'results' && state.candidates.length === 0 && (
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <p className="flex-1">{t('library.scrape.noMatch')}</p>
            {provider === 'screenscraper' && (
              <button
                type="button"
                className={`${SECONDARY_BUTTON} shrink-0`}
                onClick={props.onTryLaunchBox}
              >
                {t('library.scrape.lb.try')}
              </button>
            )}
          </div>
        )}
        {state.phase === 'results' && state.candidates.length > 0 && (
          <CandidateList
            candidates={state.candidates}
            method={state.method}
            selectedId={state.selectedId}
            onSelect={(id) => void preview(id)}
          />
        )}
        {state.previewLoading && <Busy label={t('library.scrape.loadingPreview')} />}
        {state.preview && (
          <>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                aria-label={t('library.scrape.overwrite')}
                checked={overwrite}
                onChange={(event) => {
                  setOverwrite(event.target.checked);
                  if (state.preview) setPicks(defaultPicks(state.preview, event.target.checked));
                }}
                className="accent-emerald-500"
              />
              {t('library.scrape.overwrite')}
            </label>
            <PreviewTable
              provider={provider}
              preview={state.preview}
              picks={picks}
              onToggle={(key, value) => {
                setPicks((current) => ({ ...current, [key]: value }));
              }}
            />
          </>
        )}
        {(errorKey || failed.length > 0) && (
          <div
            role="alert"
            className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300"
          >
            <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
            <div>
              {errorKey && <p>{t(errorKey)}</p>}
              {failed.map((f) => (
                <p key={f.kind}>
                  {t('library.scrape.failed', {
                    kind: t(`settings.themes.options.kinds.${f.kind}`),
                    reason: t(key(`failure.${f.code}`)),
                  })}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
