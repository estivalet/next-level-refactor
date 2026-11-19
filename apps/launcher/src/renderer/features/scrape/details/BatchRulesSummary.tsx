import type { BatchRules } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';

/** What the job was told to do, read-only and folded by default (FR-SCR-8). */
export function BatchRulesSummary({ rules }: { rules: BatchRules }) {
  const { t } = useTranslation();
  const list = (values: string[]) =>
    values.length > 0 ? values.join(', ') : t('library.batch.details.none');
  const rows: Array<[string, string]> = [
    [
      t('library.batch.details.kinds'),
      list(rules.kinds.map((kind) => t(`settings.themes.options.kinds.${kind}`))),
    ],
    [
      t('library.batch.details.fields'),
      list(rules.fields.map((field) => t(`library.fields.${field}`))),
    ],
    [t('library.batch.details.regions'), list(rules.regions.map((region) => region.toUpperCase()))],
  ];
  return (
    <details className="rounded-md bg-white/5 px-3 py-2 text-[11px] text-slate-300">
      <summary className="cursor-pointer text-slate-200">
        {t('library.batch.details.rules')}
      </summary>
      <p className="mt-2">
        {rules.onlyMissing ? t('library.batch.onlyMissing') : t('library.batch.details.allFields')}
      </p>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-500">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {rules.launchbox && <p className="mt-1">{t('library.batch.launchbox')}</p>}
    </details>
  );
}
