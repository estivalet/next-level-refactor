import type { ScanSystemResult } from '@nextlevel/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

const ROW_HEIGHT = 36;

/** Virtualized per-system lines of the last scan: games present and newly missing. */
export function ScanResults({
  results,
  nameOf,
}: {
  results: readonly ScanSystemResult[];
  nameOf: (systemId: string) => string;
}) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns functions that can't be auto-memoized; nothing here relies on the
  // React Compiler, so its "incompatible library" notice doesn't apply.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    initialRect: { width: 640, height: 240 },
  });
  if (results.length === 0) return null;

  return (
    <div ref={scroller} className="max-h-60 overflow-y-auto rounded-lg border border-white/10">
      <ul
        aria-label={t('settings.storage.scan.results')}
        className="relative"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const result = results[item.index];
          if (!result) return null;
          const counts = [t('settings.storage.scan.rowGames', { count: result.present })];
          if (result.missing > 0) {
            counts.push(t('settings.storage.scan.missing', { count: result.missing }));
          }
          return (
            <li
              key={result.systemId}
              className="absolute inset-x-0 flex items-center justify-between gap-3 border-b border-white/5 px-3 text-xs"
              style={{ top: item.start, height: ROW_HEIGHT }}
            >
              <span className="truncate text-white">{nameOf(result.systemId)}</span>
              <span className="shrink-0 text-slate-300">{counts.join(' · ')}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
