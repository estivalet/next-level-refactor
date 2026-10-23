import type { CollectionSummary } from '@nextlevel/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBridge } from '../../bridge.ts';
import { unwrap, useSystemCatalog } from '../settings/settingsApi.ts';
import { useAddToCollection } from './collectionsApi.ts';
import { useGlobalSearch } from './libraryApi.ts';
import { INPUT, Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from './Modal.tsx';

/**
 * "Add games…" (FR-LIB-8, D11): search across systems (2+ characters), tick games, add them to
 * the end. Games already in the collection show ticked and can't be changed.
 */
export function AddGamesDialog({
  collection,
  onClose,
}: {
  collection: CollectionSummary;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const search = useGlobalSearch(text);
  const add = useAddToCollection();
  const catalog = useSystemCatalog().data;
  const members = useQuery({
    queryKey: ['collections.gameIds', collection.id],
    queryFn: async () =>
      new Set(unwrap(await getBridge().invoke('collections.gameIds', { id: collection.id }))),
  });
  const systemName = (id: string) => catalog?.find((s) => s.id === id)?.name ?? id;
  const games = search.active ? (search.data?.games ?? []) : [];
  return (
    <Modal
      title={t('library.collections.addGamesTitle', { name: collection.name })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('library.collections.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={picked.length === 0 || add.isPending}
            onClick={() => {
              add.mutate({ id: collection.id, gameIds: picked }, { onSuccess: onClose });
            }}
          >
            {t('library.collections.addGamesConfirm', { count: picked.length })}
          </button>
        </>
      }
    >
      <input
        type="search"
        aria-label={t('library.collections.addGamesSearch')}
        placeholder={t('library.collections.addGamesSearch')}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
        className={INPUT}
      />
      {!search.active && (
        <p className="mt-3 text-xs text-slate-500">{t('library.collections.addGamesHint')}</p>
      )}
      <ul className="mt-3 max-h-72 space-y-0.5 overflow-y-auto text-xs">
        {games.map((game) => {
          const already = members.data?.has(game.id) === true;
          return (
            <li key={game.id}>
              <label className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={already || picked.includes(game.id)}
                  disabled={already}
                  onChange={(event) => {
                    setPicked((current) =>
                      event.target.checked
                        ? [...current, game.id]
                        : current.filter((id) => id !== game.id),
                    );
                  }}
                />
                <span className="flex-1 truncate text-slate-200">{game.title}</span>
                <span className="truncate text-slate-500">{systemName(game.systemId)}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {search.data?.more && (
        <p className="mt-2 text-[11px] text-slate-500">{t('library.collections.addGamesMore')}</p>
      )}
    </Modal>
  );
}
