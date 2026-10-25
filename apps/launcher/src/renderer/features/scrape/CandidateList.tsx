import type { ScrapeCandidate } from '@nextlevel/shared';
import { ImageOff } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

/** ScreenScraper candidates as a radio group; thumbnails come from main (`nextlevel://`). */
export function CandidateList(props: {
  candidates: readonly ScrapeCandidate[];
  method: 'hash' | 'title' | null;
  selectedId: number | null;
  onSelect: (providerGameId: number) => void;
}) {
  const { t } = useTranslation();
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={t('library.scrape.candidates')}
      className="max-h-52 overflow-y-auto rounded-lg border border-white/10"
    >
      {props.candidates.map((c) => (
        <label
          key={c.providerGameId}
          className={`flex cursor-pointer items-center gap-3 px-3 py-1.5 text-xs hover:bg-white/5 ${c.providerGameId === props.selectedId ? 'bg-emerald-500/10' : ''}`}
        >
          <input
            type="radio"
            name={name}
            aria-label={`${c.name} ${[c.year, c.region].filter(Boolean).join(' ')}`.trim()}
            checked={c.providerGameId === props.selectedId}
            onChange={() => {
              props.onSelect(c.providerGameId);
            }}
            className="accent-emerald-500"
          />
          {c.thumb ? (
            <img
              src={c.thumb}
              alt=""
              loading="lazy"
              className="h-10 w-10 rounded bg-black/40 object-contain"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded bg-black/40 text-slate-600">
              <ImageOff aria-hidden="true" className="h-4 w-4" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-white">{c.name}</span>
            <span className="block text-slate-500">
              {[c.year, c.region].filter(Boolean).join(' · ')}
            </span>
          </span>
          {props.method === 'hash' && (
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">
              {t('library.scrape.exact')}
            </span>
          )}
          <span className="w-12 text-right text-slate-400">{Math.round(c.similarity)}%</span>
        </label>
      ))}
    </div>
  );
}
