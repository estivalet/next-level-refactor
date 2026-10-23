import { useTranslation } from 'react-i18next';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../library/Modal.tsx';

/** A yes/no question over the Menu Editor (in-app: native confirm can lock inputs on Windows). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onCancel}>
            {t('menuEditor.cancel')}
          </button>
          <button type="button" className={PRIMARY_BUTTON} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {message && <p className="text-xs text-slate-300">{message}</p>}
    </Modal>
  );
}
