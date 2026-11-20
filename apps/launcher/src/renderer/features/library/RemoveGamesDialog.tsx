import type { GameScope } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { useRemoveAllMissing, useRemoveGames } from './libraryApi.ts';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from './Modal.tsx';

export type RemoveGamesTarget =
  | {
      gameIds: number[];
      /** The game's title when one is removed, for the question. */
      title?: string;
    }
  | {
      /** Remove all missing: every game the scope's Missing tab lists; main reads the ids. */
      allMissingIn: GameScope;
      /** The Missing tab's count, for the question. */
      count: number;
    };

/**
 * Asks before removing missing games from the library (FR-LIB-14, US-C7): the selected ones, or
 * all missing in a scope. Only library entries go; files on disk are never touched.
 */
export function RemoveGamesDialog(props: { target: RemoveGamesTarget; onClose: () => void }) {
  const { t } = useTranslation();
  const remove = useRemoveGames();
  const removeAll = useRemoveAllMissing();
  const { target } = props;
  let title: string;
  if ('allMissingIn' in target) {
    title = t('library.remove.titleAll', { count: target.count });
  } else if (target.gameIds.length === 1 && target.title !== undefined) {
    title = t('library.remove.titleOne', { title: target.title });
  } else {
    title = t('library.remove.titleMany', { count: target.gameIds.length });
  }
  return (
    <Modal
      title={title}
      onClose={props.onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={props.onClose}>
            {t('library.remove.cancel')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={remove.isPending || removeAll.isPending}
            onClick={() => {
              if ('allMissingIn' in target) {
                removeAll.mutate(target.allMissingIn, { onSuccess: props.onClose });
              } else {
                remove.mutate(target.gameIds, { onSuccess: props.onClose });
              }
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
