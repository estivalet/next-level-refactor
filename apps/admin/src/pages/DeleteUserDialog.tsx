import { AppErrorException } from '@nextlevel/shared';
import { Button, Dialog, TextField } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeleteUser } from '../api/hooks.ts';
import { errorKey } from '../errors.ts';
import { hrefOf } from '../router.ts';

const KNOWN = new Set(['admin', 'email']);

function deleteError(error: unknown): string | null {
  if (!error) return null;
  const reason =
    error instanceof AppErrorException
      ? (error.error.details as { reason?: unknown } | undefined)?.reason
      : undefined;
  return typeof reason === 'string' && KNOWN.has(reason)
    ? `admin.deleteUser.reasons.${reason}`
    : errorKey(error);
}

/**
 * Delete account from the console (D36): confirmed by typing the user's email. A Stripe
 * subscription is cancelled at once without a refund; then the account is deleted.
 */
export function DeleteUserDialog({
  userId,
  email,
  onClose,
}: {
  userId: string;
  email: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteUser(userId);
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  const error = deleteError(remove.error);
  return (
    <Dialog
      title={t('admin.deleteUser.title', { email })}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('admin.user.cancel')}</Button>
          <Button
            variant="danger"
            disabled={!matches || remove.isPending}
            onClick={() => {
              remove.mutate(typed.trim(), {
                onSuccess: () => {
                  window.location.hash = hrefOf({ page: 'users' });
                },
              });
            }}
          >
            {t('admin.deleteUser.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-300">{t('admin.deleteUser.body')}</p>
        <TextField
          label={t('admin.deleteUser.confirmLabel')}
          autoComplete="off"
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
          }}
        />
        {error && (
          <p role="alert" className="text-sm text-[#ff8a80]">
            {t(error)}
          </p>
        )}
      </div>
    </Dialog>
  );
}
