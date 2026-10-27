import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExportData } from '../auth/authApi.ts';
import { SECONDARY } from '../auth/GateFrame.tsx';
import { errorMessageKey } from '../settings/settingsApi.ts';
import { DeleteAccountDialog } from './DeleteAccountDialog.tsx';

/** S12 Account → Your data (security §5, D36): Download my data, Delete account. */
export function DataSection({ email }: { email: string }) {
  const { t } = useTranslation();
  const exportData = useExportData();
  const [deleting, setDeleting] = useState(false);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-white">{t('account.data.title')}</h2>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={SECONDARY}
          disabled={exportData.isPending}
          onClick={() => {
            exportData.mutate();
          }}
        >
          {t('account.data.download')}
        </button>
        {exportData.data?.saved && (
          <p role="status" className="text-xs text-emerald-300">
            {t('account.data.saved')}
          </p>
        )}
        <button
          type="button"
          className={`${SECONDARY} text-[#ff8a80]`}
          onClick={() => {
            setDeleting(true);
          }}
        >
          {t('account.data.delete')}
        </button>
      </div>
      {exportData.isError && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(errorMessageKey(exportData.error))}
        </p>
      )}
      {deleting && (
        <DeleteAccountDialog
          email={email}
          onClose={() => {
            setDeleting(false);
          }}
        />
      )}
    </section>
  );
}
