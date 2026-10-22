import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { LaunchLogRow } from './LaunchLogRow.tsx';
import { errorMessageKey, unwrap } from './settingsApi.ts';

const LOG_KEY = ['launch.log'] as const;
const PAGE_SIZE = 100;
const ROW_HEIGHT = 33;

/** The launch log, newest first, a page at a time (FR-EMU-10); refreshed when a launch ends. */
function useLaunchLog() {
  const client = useQueryClient();
  useIpcEvent('launch.finished', () => {
    void client.invalidateQueries({ queryKey: LOG_KEY });
  });
  return useInfiniteQuery({
    queryKey: LOG_KEY,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      unwrap(await getBridge().invoke('launch.log', { offset: pageParam, limit: PAGE_SIZE })),
    getNextPageParam: (last) => {
      const next = last.offset + last.entries.length;
      return last.entries.length > 0 && next < last.total ? next : undefined;
    },
  });
}

/** Settings → Data & logs → Launch log (FR-EMU-10): a virtualized list with expandable rows. */
export function LaunchLog() {
  const { t } = useTranslation();
  const log = useLaunchLog();
  const scroller = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const entries = log.data?.pages.flatMap((page) => page.entries) ?? [];
  // TanStack Virtual returns functions that can't be auto-memoized; nothing here relies on the
  // React Compiler, so its "incompatible library" notice doesn't apply.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    initialRect: { width: 640, height: 320 },
  });
  const items = virtualizer.getVirtualItems();
  const lastShown = items.at(-1)?.index ?? -1;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = log;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && lastShown >= entries.length - 1) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, lastShown, entries.length]);

  if (log.isPending) return <p className="text-xs text-slate-500">{t('library.list.loading')}</p>;
  if (log.isError) {
    return <p className="text-xs text-red-300">{t(errorMessageKey(log.error))}</p>;
  }
  if (entries.length === 0) {
    return <p className="text-xs text-slate-500">{t('settings.data.launchLog.empty')}</p>;
  }
  return (
    <div ref={scroller} className="max-h-80 overflow-y-auto rounded-lg border border-white/5">
      <ul
        aria-label={t('settings.data.launchLog.title')}
        className="relative"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {items.map((item) => {
          const entry = entries[item.index];
          if (!entry) return null;
          return (
            <li
              key={entry.id}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute inset-x-0"
              style={{ top: item.start }}
            >
              <LaunchLogRow
                entry={entry}
                expanded={expanded.has(entry.id)}
                onToggle={() => {
                  const next = new Set(expanded);
                  if (!next.delete(entry.id)) next.add(entry.id);
                  setExpanded(next);
                }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
