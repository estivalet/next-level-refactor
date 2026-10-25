import { GAME_ART_KINDS, SCRAPE_FIELDS, type ScrapePreview } from '@nextlevel/shared';
import { Lock } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { artKey, fieldKey, type Picks } from './picks.ts';

interface RowProps {
  label: string;
  checked: boolean;
  available: boolean;
  onChange: (value: boolean) => void;
  detail: ReactNode;
  /** A locked field: the description says ticking it replaces the user's value. */
  lockedNote?: string;
}

function Row({ label, checked, available, onChange, detail, lockedNote }: RowProps) {
  const { t } = useTranslation();
  const noteId = useId();
  return (
    <label
      className={`flex items-center gap-2 px-3 py-1.5 text-xs ${available ? 'cursor-pointer hover:bg-white/5' : 'opacity-50'}`}
    >
      <input
        type="checkbox"
        aria-label={label}
        aria-describedby={lockedNote ? noteId : undefined}
        checked={checked}
        disabled={!available}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="accent-emerald-500"
      />
      <span className="flex w-40 shrink-0 items-center gap-1 text-slate-200">
        {label}
        {lockedNote && <Lock aria-hidden="true" className="h-3 w-3 text-emerald-400" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-slate-400">
        {available ? detail : t('library.scrape.notAvailable')}
      </span>
      {lockedNote && (
        <span id={noteId} className="sr-only">
          {lockedNote}
        </span>
      )}
    </label>
  );
}

const SECTION = 'px-3 py-1 text-[10px] tracking-wider text-slate-500 uppercase';

/** What ScreenScraper has against what the game has (S7 Scrape…); rows are tickable. */
export function PreviewTable(props: {
  preview: ScrapePreview;
  picks: Picks;
  onToggle: (key: string, value: boolean) => void;
}) {
  const { preview, picks, onToggle } = props;
  const { t } = useTranslation();
  return (
    <div className="divide-y divide-white/5 rounded-lg border border-white/10 bg-black/20">
      <div className={SECTION}>{t('library.scrape.art')}</div>
      {GAME_ART_KINDS.map((kind) => (
        <Row
          key={kind}
          label={t(`settings.themes.options.kinds.${kind}`)}
          checked={!!picks[artKey(kind)]}
          available={preview.art[kind].available}
          onChange={(value) => {
            onToggle(artKey(kind), value);
          }}
          detail={t(preview.art[kind].local ? 'library.scrape.local' : 'library.scrape.missing')}
        />
      ))}
      <div className={SECTION}>{t('library.scrape.metadata')}</div>
      {SCRAPE_FIELDS.map((field) => {
        const row = preview.fields[field];
        return (
          <Row
            key={field}
            label={t(`library.fields.${field}`)}
            checked={!!picks[fieldKey(field)]}
            available={row.scraped !== null && row.scraped !== ''}
            onChange={(value) => {
              onToggle(fieldKey(field), value);
            }}
            {...(row.locked ? { lockedNote: t('library.scrape.locked') } : {})}
            detail={
              <>
                {row.current !== null && row.current !== '' && (
                  <span className="mr-2 line-through">{row.current}</span>
                )}
                <span className="text-slate-200">{row.scraped}</span>
              </>
            }
          />
        );
      })}
    </div>
  );
}
