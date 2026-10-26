import { Button, Dialog, TextArea } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** US-F3: suspending needs a reason (kept in the audit log). */
export function SuspendDialog({
  email,
  busy,
  onSuspend,
  onClose,
}: {
  email: string;
  busy: boolean;
  onSuspend: (reason: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  return (
    <Dialog
      title={t('admin.user.suspendTitle', { email })}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('admin.user.cancel')}</Button>
          <Button
            variant="danger"
            disabled={busy || trimmed === '' || trimmed.length > 500}
            onClick={() => {
              onSuspend(trimmed);
            }}
          >
            {t('admin.user.suspend')}
          </Button>
        </>
      }
    >
      <TextArea
        label={t('admin.user.reason')}
        help={t('admin.user.reasonHelp')}
        maxLength={500}
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
        }}
      />
    </Dialog>
  );
}
