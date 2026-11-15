import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBridge } from '../../bridge.ts';
import { useDebounced } from '../library/libraryApi.ts';
import { INPUT, Modal } from '../library/Modal.tsx';
import { unwrap } from '../settings/settingsApi.ts';

const SEARCH_DELAY_MS = 250;
const PAGE_SIZE = 50;

/** Pick one of the system's library games to pin a top game to (FR-MUS-3); first page only. */
export function GamePicker({
  systemId,
  onPick,
  onClose,
}: {
  systemId: string;
  onPick: (gameId: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const typed = useDebounced(text.trim(), SEARCH_DELAY_MS);
  const games = useQuery({
    queryKey: ['museum', 'picker', systemId, typed],
    queryFn: async () =>
      unwrap(
        await getBridge().invoke('library.games.list', {
          scope: { kind: 'system', systemId },
          tab: 'all',
          ...(typed === '' ? {} : { text: typed }),
          offset: 0,
          limit: PAGE_SIZE,
        }),
      ),
  });
  const rows = games.data?.games ?? [];
  return (
    <Modal title={t('apps.museum.pickGame')} onClose={onClose}>
      <input
        type="search"
        className={INPUT}
        aria-label={t('apps.museum.searchGames')}
        placeholder={t('apps.museum.searchGames')}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
        // The picker renders inside the entry form; Enter must not submit (save) it.
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.preventDefault();
        }}
      />
      {games.isError && (
        <p className="mt-2 text-xs text-[#ff8a80]">{t('apps.museum.gamesError')}</p>
      )}
      {games.isSuccess && rows.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">{t('apps.museum.noGames')}</p>
      )}
      <ul className="mt-2 flex flex-col">
        {rows.map((game) => (
          <li key={game.id}>
            <button
              type="button"
              className="flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/10"
              onClick={() => {
                onPick(game.id);
              }}
            >
              <span className="min-w-0 flex-1 truncate">{game.title}</span>
              {game.year !== null && <span className="text-slate-500">{game.year}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
