import { ERROR_CODES, type BatchItemOutcome, type BatchJobItem } from '@nextlevel/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBatchItems } from '../batchApi.ts';

type Filter = 'all' | BatchItemOutcome;
const FILTERS: readonly Filter[] = ['all', 'applied', 'review', 'notFound', 'failed', 'skipped'];

const OUTCOME_CLASS: Record<BatchItemOutcome, string> = {
  applied: 'text-emerald-300',
  review: 'text-amber-200',
  notFound: 'text-slate-400',
  failed: 'text-[#ff8a80]',
  skipped: 'text-slate-500',
};

/** Art failures a scrape records for a game (`ScrapeApplyResult.failed[].code`). */
const MEDIA_FAILURES = new Set(['notAvailable', 'download', 'write']);

const CHIP =
  'rounded-full px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/10 aria-pressed:bg-white/15 aria-pressed:text-white';

/**
 * Every game the job handled, newest first, with filter chips (FR-SCR-8, US-C8). The next page
 * loads when the end of the list scrolls into view; a row opens its game.
 */
export function BatchItemList({
  jobId,
  onOpenGame,
}: {
  jobId: number;
  onOpenGame: (game: { gameId: number; title: string }) => void;
}) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  const items = useBatchItems(jobId, filter === 'all' ? undefined : filter);
  const end = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = items;

  useEffect(() => {
    const node = end.current;
    // jsdom (tests) has no IntersectionObserver: the first page is all it shows.
    if (!node || !hasNextPage || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const errorText = (code: string) =>
    code in ERROR_CODES
      ? t(ERROR_CODES[code as keyof typeof ERROR_CODES])
      : code === 'MEDIA_WRITE'
        ? t('library.batch.details.mediaWrite')
        : MEDIA_FAILURES.has(code)
          ? t(`library.scrape.failure.${code}`)
          : code;
  const rows: BatchJobItem[] = items.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        role="group"
        aria-label={t('library.batch.details.filters')}
        className="flex flex-wrap gap-1"
      >
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            className={CHIP}
            onClick={() => {
              setFilter(value);
            }}
          >
            {t(`library.batch.details.outcome.${value}`)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul aria-label={t('library.batch.details.list')} className="flex flex-col">
          {rows.map((row) => (
            <li key={row.gameId}>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/5"
                onClick={() => {
                  onOpenGame({ gameId: row.gameId, title: row.title });
                }}
              >
                <span className="truncate text-slate-200">{row.title}</span>
                <span className="flex gap-2 text-[11px]">
                  <span className={OUTCOME_CLASS[row.outcome]}>
                    {t(`library.batch.details.outcome.${row.outcome}`)}
                  </span>
                  {row.provider && (
                    <span className="text-slate-500">
                      {t(`library.batch.details.source.${row.provider}`)}
                    </span>
                  )}
                  {row.error && (
                    <span className="truncate text-[#ff8a80]">{errorText(row.error)}</span>
                  )}
                  <time dateTime={row.handledAt} className="ml-auto text-slate-500">
                    {new Date(row.handledAt).toLocaleTimeString(i18n.language, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {items.isSuccess && rows.length === 0 && (
          <p className="px-2 py-3 text-xs text-slate-500">{t('library.batch.details.empty')}</p>
        )}
        {isFetchingNextPage && (
          <p className="px-2 py-2 text-xs text-slate-500">{t('library.batch.details.more')}</p>
        )}
        <div ref={end} aria-hidden="true" className="h-1" />
      </div>
    </div>
  );
}
