import type { BackupInfo } from '@nextlevel/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  errorCode,
  useBackups,
  useExportSettings,
  useImportSettings,
  useRestoreBackup,
} from './settingsApi.ts';

const BUTTON =
  'rounded-lg px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50';

/** Settings → Backups (S9, US-D3, FR-SET-3/4): list, restore with confirmation, export, import. */
export function BackupsSection() {
  const { t, i18n } = useTranslation();
  const backups = useBackups();
  const restore = useRestoreBackup();
  const exportSettings = useExportSettings();
  const importSettings = useImportSettings();
  const [confirming, setConfirming] = useState<BackupInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const section = useRef<HTMLElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (confirming) confirmButton.current?.focus();
  }, [confirming]);
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  function cancelConfirm(backup: BackupInfo) {
    setConfirming(null);
    // Back to the Restore button that opened the confirmation (rows are always rendered).
    section.current
      ?.querySelector<HTMLButtonElement>(`[data-backup-id="${CSS.escape(backup.id)}"]`)
      ?.focus();
  }

  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  const formatSize = (bytes: number) =>
    t('settings.backups.size', {
      size: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(bytes / 1024),
    });
  const describe = (changes: string[]) =>
    changes.length === 0
      ? t('settings.backups.noChanges')
      : changes
          .map((path) => {
            const key = `settings.fields.${path}.label`;
            return i18n.exists(key) ? t(key) : path;
          })
          .join(', ');
  const fail = (error: unknown) => {
    setNotice(
      errorCode(error) === 'INVALID_SETTINGS' ? 'errors.invalidSettings' : 'errors.internal',
    );
  };

  return (
    <section ref={section} className="flex flex-col gap-4 p-6">
      <p className="text-sm text-slate-300">{t('settings.backups.intro')}</p>
      <div className="flex gap-2">
        <button
          type="button"
          className={`${BUTTON} bg-white/10 text-white hover:bg-white/20`}
          onClick={() => {
            exportSettings.mutate(undefined, {
              onSuccess: (result) => {
                setNotice(result.status === 'saved' ? 'settings.backups.exported' : null);
              },
              onError: fail,
            });
          }}
        >
          {t('settings.backups.export')}
        </button>
        <button
          type="button"
          className={`${BUTTON} bg-white/10 text-white hover:bg-white/20`}
          onClick={() => {
            importSettings.mutate(undefined, {
              onSuccess: (result) => {
                setNotice(result.status === 'imported' ? 'settings.backups.imported' : null);
              },
              onError: fail,
            });
          }}
        >
          {t('settings.backups.import')}
        </button>
      </div>
      {notice && (
        <p
          ref={noticeRef}
          role="status"
          tabIndex={-1}
          className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white outline-none"
        >
          {t(notice)}
        </p>
      )}
      {confirming && (
        <div role="alert" className="flex flex-col gap-2 rounded-lg border border-white/10 p-3">
          <p className="text-xs text-slate-200">
            {t('settings.backups.confirmText', { time: formatTime(confirming.createdAt) })}
          </p>
          <div className="flex gap-2">
            <button
              ref={confirmButton}
              type="button"
              disabled={restore.isPending}
              className={`${BUTTON} bg-[#990033] text-white hover:bg-[#b3003c]`}
              onClick={() => {
                restore.mutate(confirming.id, {
                  onSuccess: () => {
                    setConfirming(null);
                    setNotice('settings.backups.restored');
                  },
                  onError: fail,
                });
              }}
            >
              {t('settings.backups.confirm')}
            </button>
            <button
              type="button"
              className={`${BUTTON} text-slate-200 hover:bg-white/10`}
              onClick={() => {
                cancelConfirm(confirming);
              }}
            >
              {t('settings.backups.cancel')}
            </button>
          </div>
        </div>
      )}
      {backups.data?.length === 0 && (
        <p className="text-sm text-slate-300">{t('settings.backups.empty')}</p>
      )}
      {backups.data && backups.data.length > 0 && (
        <table className="w-full text-left text-xs">
          <thead className="text-slate-300">
            <tr>
              <th className="py-2">{t('settings.backups.columns.time')}</th>
              <th className="py-2">{t('settings.backups.columns.changes')}</th>
              <th className="py-2">{t('settings.backups.columns.size')}</th>
              <th className="py-2">
                <span className="sr-only">{t('settings.backups.columns.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {backups.data.map((backup) => (
              <tr key={backup.id} className="border-t border-white/5 text-slate-200">
                <td className="py-2">{formatTime(backup.createdAt)}</td>
                <td className="py-2">{describe(backup.changes)}</td>
                <td className="py-2">{formatSize(backup.size)}</td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    data-backup-id={backup.id}
                    className={`${BUTTON} text-white hover:bg-white/10`}
                    onClick={() => {
                      setNotice(null);
                      setConfirming(backup);
                    }}
                  >
                    {t('settings.backups.restore')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
