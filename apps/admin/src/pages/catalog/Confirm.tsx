import { Button, Dialog } from '@nextlevel/ui';
import { useTranslation } from 'react-i18next';

/** A yes/no question before a change players notice (replace, remove, unpublish). */
export function Confirm({
  title,
  body,
  action,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  action: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('admin.catalog.cancel')}</Button>
          <Button
            variant="danger"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {action}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-300">{body}</p>
    </Dialog>
  );
}
