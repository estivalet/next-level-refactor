import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface GlobalSearchProps {
  text: string;
  onText: (text: string) => void;
}

/** "Search all games…" in the Library header (FR-LIB-10); Esc clears it. */
export function GlobalSearch({ text, onText }: GlobalSearchProps) {
  const { t } = useTranslation();
  return (
    <div className="relative w-80 max-w-full">
      <Search
        aria-hidden="true"
        className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-violet-400"
      />
      <input
        type="search"
        aria-label={t('library.search.label')}
        placeholder={t('library.search.placeholder')}
        value={text}
        onChange={(event) => {
          onText(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onText('');
        }}
        className="w-full rounded-lg border border-violet-500/30 bg-black/40 py-1.5 pr-8 pl-8 text-xs text-white placeholder:text-slate-600 focus:border-violet-500/60 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          aria-label={t('library.search.clear')}
          onClick={() => {
            onText('');
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-500 hover:text-white"
        >
          <X aria-hidden="true" className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
