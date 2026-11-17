import type { SystemInfoSummary } from '@nextlevel/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { HardwareImage } from './HardwareImage.tsx';
import { homeCounts, recentlyChanged, withNotes } from './homeSelectors.ts';
import { MuseumWelcome } from './MuseumWelcome.tsx';
import { systemDetail } from './SystemList.tsx';

interface Props {
  systems: readonly SystemInfoSummary[];
  onOpen: (systemId: string) => void;
}

function CardRow({
  title,
  systems,
  onOpen,
}: {
  title: string;
  systems: readonly SystemInfoSummary[];
  onOpen: (systemId: string) => void;
}) {
  const headingId = useId();
  if (systems.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <h3 id={headingId} className="mb-3 text-base font-semibold text-slate-100">
        {title}
      </h3>
      {/* Only this row scrolls sideways; the page itself never does. */}
      <ul className="flex gap-4 overflow-x-auto pb-2">
        {systems.map((system) => {
          const detail = systemDetail(system);
          return (
            <li key={system.systemId} className="shrink-0">
              <button
                type="button"
                className="flex w-40 flex-col gap-2 rounded-xl bg-white/5 p-2 text-left hover:bg-white/10"
                onClick={() => {
                  onOpen(system.systemId);
                }}
              >
                <HardwareImage name={system.name} size="card" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-100">
                    {system.name}
                  </span>
                  {detail && (
                    <span className="block truncate text-xs text-slate-500">{detail}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The Museum's Home page (FR-MUS-9): a welcome banner, the totals line, then rows of cards for
 * recently changed systems and systems with the owner's notes. Empty rows are hidden.
 */
export function MuseumHome({ systems, onOpen }: Props) {
  const { t } = useTranslation();
  const counts = homeCounts(systems);
  return (
    <section
      data-testid="museum-scroll"
      className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
    >
      <MuseumWelcome />
      <div className="flex flex-col gap-6 p-6">
        <p data-testid="museum-counts" className="text-sm text-slate-400">
          {[
            t('apps.museum.counts.systems', { count: counts.systems }),
            t('apps.museum.counts.edited', { count: counts.edited }),
            t('apps.museum.counts.notes', { count: counts.notes }),
          ].join(' · ')}
        </p>
        <CardRow
          title={t('apps.museum.recentlyChanged')}
          systems={recentlyChanged(systems)}
          onOpen={onOpen}
        />
        <CardRow title={t('apps.museum.hasNotes')} systems={withNotes(systems)} onOpen={onOpen} />
      </div>
    </section>
  );
}
