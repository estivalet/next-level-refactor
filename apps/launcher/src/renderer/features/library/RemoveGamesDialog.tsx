import { useTranslation } from 'react-i18next';
import { useRemoveGames } from './libraryApi.ts';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from './Modal.tsx';

export interface RemoveGamesTarget {
  gameIds: number[];
  /** The game's title when one is removed, for the question. */
  title?: string;
}

/** Asks before removing missing games from the library (FR-LIB-14, US-C7). */
export function RemoveGamesDialog(props: { target: RemoveGamesTarget; onClose: () => void }) {
  const { t } = useTranslation();
  const remove = useRemoveGames();
  const { gameIds, title } = props.target;
  return (
    <Modal
      title={
        gameIds.length === 1 && title !== undefined
          ? t('library.remove.titleOne', { title })
          : t('library.remove.titleMany', { count: gameIds.length })
      }
      onClose={props.onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={props.onClose}>
            {t('library.remove.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate(gameIds, { onSuccess: props.onClose });
            }}
          >
            {t('library.remove.confirm')}
          </button>
        </>
      }
    >
      <p className="text-xs text-slate-300">{t('library.remove.body')}</p>
    </Modal>
  );
}
