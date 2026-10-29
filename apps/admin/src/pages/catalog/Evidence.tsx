import type { AdminCatalogItem } from '@nextlevel/shared';
import { Button } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUploadEvidence, useVerifyLicense } from '../../api/catalog.ts';
import { formatTime } from '../../errors.ts';
import { catalogErrorKey, reasonOf } from './catalogText.ts';
import { Progress, type Sending } from './Progress.tsx';

/**
 * The permission document and verification (content policy §4, D44): Mark verified needs the
 * evidence first; a verified license's evidence can't change (save a new license instead).
 */
export function Evidence({ item, evidenceUrl }: { item: AdminCatalogItem; evidenceUrl: string }) {
  const { t, i18n } = useTranslation();
  const upload = useUploadEvidence(item.id);
  const verify = useVerifyLicense(item.id);
  const [sending, setSending] = useState<Sending | null>(null);
  const license = item.license;
  const verified = license?.verifiedAt != null;
  const error = upload.error ?? verify.error;

  return (
    <section aria-labelledby="evidence-title" className="flex flex-col gap-3">
      <h2 id="evidence-title" className="text-sm font-medium text-white">
        {t('admin.catalog.license.evidence')}
      </h2>
      {!license ? (
        <p className="text-sm text-slate-500">{t('admin.catalog.license.saveFirst')}</p>
      ) : license.evidenceFilename ? (
        <a href={evidenceUrl} className="text-sm text-sky-300 hover:underline">
          {license.evidenceFilename}
        </a>
      ) : (
        <p className="text-sm text-slate-500">{t('admin.catalog.license.noEvidence')}</p>
      )}
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
        {t('admin.catalog.license.uploadEvidence')}
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.eml"
          disabled={!license || verified || sending !== null}
          className="text-sm text-slate-300"
          onChange={(event) => {
            const picked = event.target.files?.[0];
            event.target.value = '';
            if (!picked) return;
            verify.reset();
            setSending({ name: picked.name, loaded: 0, total: picked.size });
            upload.mutate(
              {
                file: picked,
                onProgress: (loaded, total) => {
                  setSending({ name: picked.name, loaded, total });
                },
              },
              {
                onSettled: () => {
                  setSending(null);
                },
              },
            );
          }}
        />
      </label>
      <p className="text-xs text-slate-500">{t('admin.catalog.license.evidenceHelp')}</p>
      {sending && <Progress sending={sending} />}
      {verified ? (
        <p className="text-sm text-emerald-300">
          {t('admin.catalog.license.verifiedBy', {
            email: license.verifiedBy?.email ?? t('admin.audit.system'),
            time: formatTime(license.verifiedAt, i18n.language, ''),
          })}
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            disabled={!license?.evidenceFilename || verify.isPending}
            aria-describedby={license && !license.evidenceFilename ? 'verify-why' : undefined}
            onClick={() => {
              upload.reset();
              verify.mutate();
            }}
          >
            {t('admin.catalog.license.verify')}
          </Button>
          {license && !license.evidenceFilename && (
            <p id="verify-why" className="text-sm text-slate-400">
              {t('admin.catalog.errors.noEvidence')}
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {reasonOf(error) === 'type'
            ? t('admin.catalog.license.evidenceType')
            : t(catalogErrorKey(error))}
        </p>
      )}
    </section>
  );
}
