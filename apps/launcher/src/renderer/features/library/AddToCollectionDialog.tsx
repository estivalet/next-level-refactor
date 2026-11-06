import { CollectionNameSchema } from '@nextlevel/shared';
import { useQueries } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBridge } from '../../bridge.ts';
import { errorCode, unwrap } from '../settings/settingsApi.ts';
import {
  useAddToCollection,
  useCollections,
  useCreateCollectionWithGames,
  useRemoveFromCollection,
} from './collectionsApi.ts';
import { GAME_KEY } from './libraryApi.ts';
import { INPUT, Modal, SECONDARY_BUTTON } from './Modal.tsx';

/**
 * Tick the collections the selected games belong to (FR-LIB-8). A box is ticked when every
 * selected game is in that collection and half-ticked when only some are; ticking adds them all,
 * unticking removes them all. The box narrows a long list of collections; a name no collection
 * has yet offers New collection “name”, which creates it with the games in it (also on Enter).
 */
export function AddToCollection({ gameIds, onClose }: { gameIds: number[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  // A clicked box shows its new state at once; the saved membership takes over when the change
  // (and the refresh it triggers) settles.
  const [ticked, setTicked] = useState<Record<number, boolean>>({});
  const collections = useCollections();
  const add = useAddToCollection();
  const remove = useRemoveFromCollection();
  const create = useCreateCollectionWithGames();
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
  const name = text.trim();
  const canCreate =
    CollectionNameSchema.safeParse(name).success &&
    !all.some((c) => c.name.toLowerCase() === name.toLowerCase());
  const createNew = () => {
    if (!canCreate || create.isPending) return;
    create.mutate(
      { name, gameIds },
      {
        onSuccess: () => {
          setText('');
        },
      },
    );
  };
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
      <input
        type="search"
        aria-label={t('library.collections.filter')}
        placeholder={t('library.collections.filter')}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          create.reset();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') createNew();
        }}
        className={INPUT}
      />
      {all.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">{t('library.collections.none')}</p>
      ) : (
        shown.length === 0 &&
        !canCreate && (
          <p className="mt-3 text-xs text-slate-500">{t('library.collections.noMatch')}</p>
        )
      )}
      {shown.length > 0 && (
        <ul className="mt-3 max-h-72 space-y-0.5 overflow-y-auto text-xs">
          {shown.map((collection) => {
            const count = inCollection(collection.id);
            const checked = ticked[collection.id] ?? (loaded && count === gameIds.length);
            return (
              <li key={collection.id}>
                <label className="flex items-center gap-2 rounded px-1 py-1 text-slate-300 hover:bg-white/5 hover:text-white">
                  <input
                    type="checkbox"
                    checked={checked}
                    ref={(box) => {
                      if (box)
                        box.indeterminate = count > 0 && !checked && !(collection.id in ticked);
                    }}
                    disabled={pending}
                    onChange={() => {
                      const input = { id: collection.id, gameIds };
                      const settled = {
                        onSettled: () => {
                          setTicked((current) =>
                            Object.fromEntries(
                              Object.entries(current).filter(
                                ([id]) => Number(id) !== collection.id,
                              ),
                            ),
                          );
                        },
                      };
                      setTicked((current) => ({ ...current, [collection.id]: !checked }));
                      if (checked) remove.mutate(input, settled);
                      else add.mutate(input, settled);
                    }}
                  />
                  <span className="flex-1 truncate">{collection.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {canCreate && (
        <button
          type="button"
          disabled={create.isPending}
          onClick={createNew}
          className="mt-2 flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs text-emerald-300 hover:bg-white/5 hover:text-emerald-200 disabled:opacity-50"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{t('library.collections.createWith', { name })}</span>
        </button>
      )}
      {errorCode(create.error) === 'NAME_TAKEN' && (
        <p className="mt-1 text-[11px] text-red-300">{t('errors.nameTaken')}</p>
      )}
    </Modal>
  );
}
