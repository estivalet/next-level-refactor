import {
  ERROR_CODES,
  GEMINI_FIELDS,
  type GameDetails,
  type GeminiDialogView,
} from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBridge } from '../../bridge.ts';
import { invalidateGames, useGameDetails } from '../library/libraryApi.ts';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../library/Modal.tsx';
import { useGeminiKeyStatus } from '../settings/scraper/geminiApi.ts';
import { errorMessageKey, unwrap } from '../settings/settingsApi.ts';
import { useOpenApp } from '../shell/useOpenApp.ts';

/** Row order: the six details, then the title suggestion (never ticked at first, spec §5). */
const ROWS = [...GEMINI_FIELDS, 'title'] as const;
type Row = (typeof ROWS)[number];
type Picks = Partial<Record<Row, boolean>>;

const isEmpty = (value: unknown) => value === null || value === undefined || value === '';

/** First ticks: empty, unlocked fields Gemini knows; never the title or a filled field. */
function defaultPicks(view: GeminiDialogView): Picks {
  const picks: Picks = {};
  for (const row of ROWS) {
    const field = view.fields[row];
    picks[row] =
      row !== 'title' &&
      field !== undefined &&
      field.scraped !== null &&
      isEmpty(field.current) &&
      !field.locked;
  }
  return picks;
}

interface Request {
  /** false = show a stored answer when there is one. */
  fresh: boolean;
  allFields: boolean;
}

/**
 * Fill details with Gemini… (FR-SCR-7): a stored answer (Needs review) opens without a request;
 * otherwise Gemini is asked about the game's empty fields. Only ticked rows are written.
 */
export function GeminiDialog(props: { gameId: number; onClose: () => void }) {
  const details = useGameDetails(props.gameId);
  const key = useGeminiKeyStatus();
  return details.data && key.data ? (
    <GeminiForm game={details.data} hasKey={key.data.set} onClose={props.onClose} />
  ) : null;
}

function GeminiForm(props: { game: GameDetails; hasKey: boolean; onClose: () => void }) {
  const { game, hasKey, onClose } = props;
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const openApp = useOpenApp();
  const [request, setRequest] = useState<Request>({ fresh: false, allFields: false });
  const view = useQuery({
    queryKey: ['gemini.view', game.id, request],
    enabled: hasKey,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    queryFn: async () => {
      if (!request.fresh) {
        const stored = unwrap(await getBridge().invoke('gemini.stored', { gameId: game.id }));
        if (stored) return { view: stored, stored: true };
      }
      const input = request.allFields ? { gameId: game.id, allFields: true } : { gameId: game.id };
      return { view: unwrap(await getBridge().invoke('gemini.ask', input)), stored: false };
    },
  });
  const [picks, setPicks] = useState<Picks>({});
  const [picksFor, setPicksFor] = useState<GeminiDialogView | null>(null);
  const current = view.data?.view ?? null;
  if (current !== picksFor) {
    setPicksFor(current);
    setPicks(current ? defaultPicks(current) : {});
  }
  const done = () => {
    void invalidateGames(client);
    onClose();
  };
  const apply = useMutation({
    mutationFn: async (fields: Row[]) =>
      unwrap(await getBridge().invoke('gemini.apply', { gameId: game.id, fields })),
    onSuccess: done,
  });
  const dismiss = useMutation({
    mutationFn: async () => {
      unwrap(await getBridge().invoke('gemini.dismiss', { gameId: game.id }));
    },
    onSuccess: done,
  });
  const ticked = ROWS.filter((row) => picks[row] === true);
  const error = apply.error ?? dismiss.error ?? view.error;
  const askedAt = current ? new Date(current.answer.askedAt).toLocaleString(i18n.language) : '';

  return (
    <Modal
      title={t('library.scrape.gm.title', { title: game.title })}
      onClose={onClose}
      footer={
        <>
          {view.data?.stored && (
            <button
              type="button"
              className={SECONDARY_BUTTON}
              disabled={dismiss.isPending}
              onClick={() => {
                dismiss.mutate();
              }}
            >
              {t('library.scrape.gm.dismiss')}
            </button>
          )}
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('library.scrape.close')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={!current || ticked.length === 0 || apply.isPending}
            onClick={() => {
              apply.mutate([...ticked]);
            }}
          >
            {t(apply.isPending ? 'library.scrape.applying' : 'library.scrape.apply')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {!hasKey && (
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <p className="flex-1">{t(ERROR_CODES.GEMINI_NO_KEY)}</p>
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() => {
                openApp('settings', { section: 'scraper' });
              }}
            >
              {t('library.geminiBatch.openSettings')}
            </button>
          </div>
        )}
        {view.isFetching && (
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            {t('library.scrape.gm.asking')}
          </p>
        )}
        {current && !view.isFetching && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              {view.data?.stored && (
                <p className="flex-1">{t('library.scrape.gm.stored', { date: askedAt })}</p>
              )}
              <button
                type="button"
                className={SECONDARY_BUTTON}
                onClick={() => {
                  setRequest({ fresh: true, allFields: true });
                }}
              >
                {t('library.scrape.gm.askAll')}
              </button>
              {view.data?.stored && (
                <button
                  type="button"
                  className={SECONDARY_BUTTON}
                  onClick={() => {
                    setRequest({ fresh: true, allFields: false });
                  }}
                >
                  {t('library.scrape.gm.askAgain')}
                </button>
              )}
            </div>
            <Rows
              view={current}
              picks={picks}
              onToggle={(row, value) => {
                setPicks((now) => ({ ...now, [row]: value }));
              }}
            />
            <Sources view={current} />
          </>
        )}
        {error && (
          <div
            role="alert"
            className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300"
          >
            <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
            <p>{t(errorMessageKey(error))}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Rows(props: {
  view: GeminiDialogView;
  picks: Picks;
  onToggle: (row: Row, value: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col rounded-lg border border-white/10 py-1">
      {ROWS.map((row) => {
        const field = props.view.fields[row];
        if (!field) return null;
        const known = field.scraped !== null;
        const label = t(`scrape.fields.${row}`);
        return (
          <label
            key={row}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs ${known ? 'cursor-pointer hover:bg-white/5' : 'opacity-50'}`}
          >
            <input
              type="checkbox"
              aria-label={label}
              checked={props.picks[row] === true}
              disabled={!known}
              onChange={(event) => {
                props.onToggle(row, event.target.checked);
              }}
              className="accent-emerald-500"
            />
            <span className="w-40 shrink-0 text-slate-200">
              {row === 'title' ? t('library.scrape.gm.suggested') : label}
            </span>
            <span className="min-w-0 flex-1 truncate text-slate-400">
              {known ? (
                <>
                  {!isEmpty(field.current) && (
                    <span className="line-through">{String(field.current)}</span>
                  )}{' '}
                  {String(field.scraped)}
                </>
              ) : (
                t('library.scrape.gm.notAvailable')
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function Sources({ view }: { view: GeminiDialogView }) {
  const { t } = useTranslation();
  if (view.answer.sources.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 text-xs">
      <p className="text-slate-500">{t('library.scrape.gm.sources')}</p>
      <ul className="flex flex-col gap-0.5">
        {view.answer.sources.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-slate-300 underline hover:text-white"
            >
              {source.title || source.url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
