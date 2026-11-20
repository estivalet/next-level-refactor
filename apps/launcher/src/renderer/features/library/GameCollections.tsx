import type { GameDetails } from '@nextlevel/shared';
import { FolderPlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCollections, useRemoveFromCollection } from './collectionsApi.ts';

/**
 * The collections a game is in, as chips (FR-LIB-8, US-C10): × takes the game out of that
 * collection (the game stays in the library), and Add to collection… opens the add dialog.
 */
export function GameCollections({
  game,
  onAdd,
}: {
  game: GameDetails;
  onAdd: (gameId: number) => void;
}) {
  const { t } = useTranslation();
  const collections = useCollections();
  const remove = useRemoveFromCollection();
  const names = new Map((collections.data ?? []).map((c) => [c.id, c.name]));
  const member = game.collectionIds
    .flatMap((id) => {
      const name = names.get(id);
      return name === undefined ? [] : [{ id, name }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-slate-500">{t('library.details.collections')}</span>
      {member.length === 0 ? (
        <p className="text-xs text-slate-500">{t('library.details.noCollections')}</p>
      ) : (
        <ul aria-label={t('library.details.collections')} className="flex flex-wrap gap-1">
          {member.map((collection) => (
            <li
              key={collection.id}
              className="flex items-center gap-1 rounded-md bg-emerald-500/10 py-0.5 pr-0.5 pl-2 text-[10px] text-emerald-300"
            >
              {collection.name}
              <button
                type="button"
                aria-label={t('library.details.removeFromCollection', { name: collection.name })}
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate({ id: collection.id, gameIds: [game.id] });
                }}
                className="rounded p-0.5 text-emerald-300/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="flex w-fit items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white"
        onClick={() => {
          onAdd(game.id);
        }}
      >
        <FolderPlus aria-hidden="true" className="h-3.5 w-3.5" />
        {t('library.collections.add')}
      </button>
    </div>
  );
}
