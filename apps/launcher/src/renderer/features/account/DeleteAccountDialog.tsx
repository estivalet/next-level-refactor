import { AppErrorException } from '@nextlevel/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeleteAccount } from '../auth/authApi.ts';
import { INPUT, Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../library/Modal.tsx';
import { errorMessageKey } from '../settings/settingsApi.ts';

/** An admin is refused until demoted (D36); anything else is the code's own message. */
function deleteErrorKey(error: unknown): string {
  const reason =
    error instanceof AppErrorException
      ? (error.error.details as { reason?: unknown } | undefined)?.reason
      : undefined;
  return reason === 'admin' ? 'account.data.adminFirst' : errorMessageKey(error);
}

/**
 * Delete account (D36): says what happens (subscription cancelled now, no automatic refund, the
 * local library stays), and is confirmed by typing the account's email (any letter case).
 */
export function DeleteAccountDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const { t } = useTranslation();
  const remove = useDeleteAccount();
  const [typed, setTyped] = useState('');
  const fieldId = useId();
  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  return (
    <Modal
      title={t('account.data.deleteTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('account.data.cancel')}
          </button>
          <button
            type="button"
            className={`${PRIMARY_BUTTON} bg-red-500 hover:bg-red-400`}
            disabled={!matches || remove.isPending}
            onClick={() => {
              remove.mutate(typed.trim());
            }}
          >
            {t('account.data.confirm')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-slate-300">
        <p>{t('account.data.deleteBody')}</p>
        <label htmlFor={fieldId} className="text-xs text-slate-400">
          {t('account.data.confirmLabel')}
        </label>
        <input
          id={fieldId}
          className={INPUT}
          autoComplete="off"
          placeholder={email}
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
          }}
        />
        {remove.isError && (
          <p role="alert" className="text-sm text-[#ff8a80]">
            {t(deleteErrorKey(remove.error))}
          </p>
        )}
      </div>
    </Modal>
  );
}
