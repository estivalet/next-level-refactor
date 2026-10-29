import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../library/Modal.tsx';
import { useUninstall } from './catalogApi.ts';
import { reasonOf } from './catalogText.ts';

/**
 * Uninstall (FR-CAT-5, US-E3): asks main first without confirming; a favorite or a game in a
 * collection comes back `CONFLICT inCollections`, and then the player is asked.
 */
export function useUninstallFlow() {
  const uninstall = useUninstall();
  const [asking, setAsking] = useState<{ itemId: string; title: string } | null>(null);
  return {
    pending: uninstall.isPending,
    error: asking ? null : uninstall.error,
    start: (itemId: string, title: string) => {
      uninstall.mutate(
        { itemId, confirm: false },
        {
          onError: (error) => {
            if (reasonOf(error) === 'inCollections') setAsking({ itemId, title });
          },
        },
      );
    },
    dialog: asking ? (
      <UninstallDialog
        title={asking.title}
        onCancel={() => {
          setAsking(null);
          uninstall.reset();
        }}
        onConfirm={() => {
          uninstall.mutate({ itemId: asking.itemId, confirm: true });
          setAsking(null);
        }}
      />
    ) : null,
  };
}

export function UninstallDialog({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      title={t('catalog.uninstall.title', { title })}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onCancel}>
            {t('catalog.uninstall.cancel')}
          </button>
          <button type="button" className={PRIMARY_BUTTON} onClick={onConfirm}>
            {t('catalog.uninstall.confirm')}
          </button>
        </>
      }
    >
      <p className="px-4 py-3 text-sm text-slate-300">{t('catalog.uninstall.body')}</p>
    </Modal>
  );
}
