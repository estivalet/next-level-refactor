import { defaultSettings, type CatalogListItem, type DownloadSummary } from '@nextlevel/shared';
import { useInputActions } from '@nextlevel/themes';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings, useSystemCatalog } from '../settings/settingsApi.ts';
import { useCatalogList, useDownloads } from './catalogApi.ts';
import { isOffline } from './catalogText.ts';
import { moveCardFocus } from './cardNav.ts';
import { ItemCard } from './ItemCard.tsx';
import { ItemDetail } from './ItemDetail.tsx';

const FIELD =
  'rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';

/** The text after typing paused for a moment. */
function useDebounced(text: string, delay = 300): string {
  const [value, setValue] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => {
      setValue(text);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [text, delay]);
  return value;
}

/**
 * Catalog → Browse (S8, FR-CAT-1, D46, D47): the Starter set (hidden when empty), New, then a
 * row per system; search and filters show results instead. Arrow keys and a gamepad move across
 * cards; select opens one, back closes it.
 */
export function BrowseTab({ onPlay }: { onPlay: (gameId: number) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const q = useDebounced(text.trim());
  const [system, setSystem] = useState('');
  const [genre, setGenre] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const filtering = q !== '' || system !== '' || genre !== '';

  const all = useCatalogList({ limit: 100 });
  const starter = useCatalogList({ starter: 'true', limit: 24 }, !filtering);
  const fresh = useCatalogList({ sort: 'new', limit: 12 }, !filtering);
  const results = useCatalogList(
    {
      limit: 100,
      ...(q ? { q } : {}),
      ...(system ? { system } : {}),
      ...(genre ? { genre } : {}),
    },
    filtering,
  );
  const downloads = useDownloads().data ?? [];
  const systems = useSystemCatalog().data ?? [];
  const loaded = useSettings().data;
  // The player's bindings (Settings → Input); the defaults until the settings arrive.
  const input = useMemo(
    () => (loaded?.kind === 'ok' ? loaded.snapshot.settings : defaultSettings()).input,
    [loaded],
  );
  const nameOf = (id: string) => systems.find((s) => s.id === id)?.name ?? id;
  const items = useMemo(() => all.data?.items ?? [], [all.data]);
  const bySystem = useMemo(() => {
    const groups = new Map<string, CatalogListItem[]>();
    for (const item of items)
      groups.set(item.systemId, [...(groups.get(item.systemId) ?? []), item]);
    return [...groups];
  }, [items]);
  const genres = [...new Set(items.map((item) => item.genre).filter(Boolean))].sort();

  useInputActions({
    targetRef: container,
    enabled: focused && selected === null,
    input,
    onAction: (action) => {
      const box = container.current;
      if (!box) return;
      if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
        moveCardFocus(box, action);
      } else if (action === 'select' && document.activeElement instanceof HTMLButtonElement) {
        document.activeElement.click();
      }
    },
  });

  if (selected) {
    return (
      <ItemDetail
        itemId={selected}
        onBack={() => {
          setSelected(null);
        }}
        onPlay={onPlay}
      />
    );
  }
  if (all.error) {
    return (
      <p role="alert" className="p-6 text-sm text-slate-300">
        {t(isOffline(all.error) ? 'catalog.offline' : 'catalog.loadFailed')}
      </p>
    );
  }

  const row = (name: string, rowItems: CatalogListItem[], key = name) => (
    <section key={key} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-white">{name}</h3>
      <ul aria-label={name} data-card-row className="flex gap-3 overflow-x-auto pb-2">
        {rowItems.map((item) => (
          <li key={item.id}>
            <ItemCard
              item={item}
              systemName={nameOf(item.systemId)}
              download={downloads.find((d: DownloadSummary) => d.itemId === item.id)}
              onOpen={setSelected}
            />
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div
      ref={container}
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2">
          <Search aria-hidden="true" className="h-4 w-4 text-slate-400" />
          <input
            type="search"
            aria-label={t('catalog.search')}
            placeholder={t('catalog.search')}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
            className="w-56 bg-transparent py-1 text-sm text-white focus-visible:outline-none"
          />
        </label>
        <select
          aria-label={t('catalog.system')}
          value={system}
          onChange={(event) => {
            setSystem(event.target.value);
          }}
          className={FIELD}
        >
          <option value="">{t('catalog.allSystems')}</option>
          {bySystem.map(([id]) => (
            <option key={id} value={id}>
              {nameOf(id)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('catalog.genre')}
          value={genre}
          onChange={(event) => {
            setGenre(event.target.value);
          }}
          className={FIELD}
        >
          <option value="">{t('catalog.allGenres')}</option>
          {genres.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {filtering ? (
        (results.data?.items.length ?? 0) === 0 && results.isSuccess ? (
          <p className="text-sm text-slate-400">{t('catalog.noResults')}</p>
        ) : (
          row(t('catalog.results'), results.data?.items ?? [])
        )
      ) : (
        <>
          {(starter.data?.items.length ?? 0) > 0 &&
            row(t('catalog.starter'), starter.data?.items ?? [])}
          {(fresh.data?.items.length ?? 0) > 0 && row(t('catalog.new'), fresh.data?.items ?? [])}
          {bySystem.map(([id, list]) => row(nameOf(id), list, id))}
          {all.isSuccess && items.length === 0 && (
            <p className="text-sm text-slate-400">{t('catalog.empty')}</p>
          )}
        </>
      )}
    </div>
  );
}
