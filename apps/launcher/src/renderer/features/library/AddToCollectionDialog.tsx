import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBridge } from '../../bridge.ts';
import { unwrap } from '../settings/settingsApi.ts';
import { useAddToCollection, useCollections, useRemoveFromCollection } from './collectionsApi.ts';
import { GAME_KEY } from './libraryApi.ts';
import { INPUT, Modal, SECONDARY_BUTTON } from './Modal.tsx';

/**
 * Tick the collections the selected games belong to (FR-LIB-8). A box is ticked when every
 * selected game is in that collection and half-ticked when only some are; ticking adds them all,
 * unticking removes them all. The filter narrows a long list of collections.
 */
export function AddToCollection({ gameIds, onClose }: { gameIds: number[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const collections = useCollections();
  const add = useAddToCollection();
  const remove = useRemoveFromCollection();
  // Same key as useGameDetails, so a collection change refreshes the boxes.
  const details = useQueries({
    queries: gameIds.map((gameId) => ({
      queryKey: [GAME_KEY, gameId],
      queryFn: async () => unwrap(await getBridge().invoke('library.games.get', { gameId })),
    })),
  });
  const loaded = details.every((detail) => detail.data !== undefined);
  const inCollection = (id: number) =>
    details.filter((detail) => detail.data?.collectionIds.includes(id) === true).length;
  const all = collections.data ?? [];
  const needle = text.trim().toLowerCase();
  const shown = needle ? all.filter((c) => c.name.toLowerCase().includes(needle)) : all;
  const pending = add.isPending || remove.isPending || !loaded;
  return (
    <Modal
      title={t('library.collections.addTitle', { count: gameIds.length })}
      onClose={onClose}
      footer={
        <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
          {t('library.collections.done')}
        </button>
      }
    >
      {all.length === 0 ? (
        <p className="text-xs text-slate-500">{t('library.collections.none')}</p>
      ) : (
        <>
          <input
            type="search"
            aria-label={t('library.collections.filter')}
            placeholder={t('library.collections.filter')}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
            className={INPUT}
          />
          {shown.length === 0 && (
            <p className="mt-3 text-xs text-slate-500">{t('library.collections.noMatch')}</p>
          )}
          <ul className="mt-3 max-h-72 space-y-0.5 overflow-y-auto text-xs">
            {shown.map((collection) => {
              const count = inCollection(collection.id);
              const checked = loaded && count === gameIds.length;
              return (
                <li key={collection.id}>
                  <label className="flex items-center gap-2 rounded px-1 py-1 text-slate-300 hover:bg-white/5 hover:text-white">
                    <input
                      type="checkbox"
                      checked={checked}
                      ref={(box) => {
                        if (box) box.indeterminate = count > 0 && !checked;
                      }}
                      disabled={pending}
                      onChange={() => {
                        const input = { id: collection.id, gameIds };
                        if (checked) remove.mutate(input);
                        else add.mutate(input);
                      }}
                    />
                    <span className="flex-1 truncate">{collection.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}
