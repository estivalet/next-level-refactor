import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Search within the open scope (FR-LIB-10, D66): narrows its list like global search does, which
 * stays for all games. Escape or the clear button empties it.
 */
export function ScopeSearch({
  scopeName,
  text,
  onText,
}: {
  scopeName: string;
  text: string;
  onText: (text: string) => void;
}) {
  const { t } = useTranslation();
  const label = t('library.scopeSearch.placeholder', { scope: scopeName });
  return (
    <div className="relative w-56 shrink-0">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
      />
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        value={text}
        maxLength={200}
        onChange={(event) => {
          onText(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && text !== '') {
            event.stopPropagation();
            onText('');
          }
        }}
        className="w-full rounded-md border border-white/15 bg-black/30 py-1 pr-7 pl-7 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {text !== '' && (
        <button
          type="button"
          aria-label={t('library.scopeSearch.clear')}
          onClick={() => {
            onText('');
          }}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-white"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
