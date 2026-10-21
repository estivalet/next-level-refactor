import { Folder } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAddToCollection, useCollections } from './collectionsApi.ts';
import { Modal } from './Modal.tsx';

/** Add the selected games to a collection (FR-LIB-8). */
export function AddToCollection({ gameIds, onClose }: { gameIds: number[]; onClose: () => void }) {
  const { t } = useTranslation();
  const collections = useCollections();
  const add = useAddToCollection();
  return (
    <Modal title={t('library.collections.addTitle', { count: gameIds.length })} onClose={onClose}>
      {(collections.data ?? []).length === 0 ? (
        <p className="text-xs text-slate-500">{t('library.collections.none')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {(collections.data ?? []).map((collection) => (
            <li key={collection.id}>
              <button
                type="button"
                disabled={add.isPending}
                onClick={() => {
                  add.mutate({ id: collection.id, gameIds }, { onSuccess: onClose });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <Folder aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" />
                {collection.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
