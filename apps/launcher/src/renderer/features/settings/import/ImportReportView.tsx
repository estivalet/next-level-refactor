import { IMPORT_AREAS, type ImportItem, type ImportReport } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';

const COUNT_KEYS = [
  'systems',
  'menus',
  'menuNodes',
  'gamelists',
  'games',
  'collections',
  'collectionEntries',
] as const;

const FILE_KEYS = ['withFile', 'missing', 'newFiles'] as const;

function ItemList({
  items,
  label,
  open = false,
}: {
  items: readonly ImportItem[];
  label: string;
  open?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const format = (n: number) => n.toLocaleString(i18n.language);
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + (item.count ?? 1), 0);
  return (
    <details open={open} className="rounded-lg border border-white/10 bg-black/20 p-3">
      <summary className="cursor-pointer text-sm font-medium text-white">
        {label} ({format(total)})
      </summary>
      {IMPORT_AREAS.map((area) => {
        const inArea = items.filter((item) => item.area === area);
        if (inArea.length === 0) return null;
        return (
          <section key={area} className="mt-3">
            <h5 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              {t(`settings.import.area.${area}`)}
            </h5>
            <ul className="mt-1 flex flex-col gap-1">
              {inArea.map((item, index) => (
                <li key={`${item.key}-${item.reason}-${String(index)}`} className="text-xs">
                  <span className="text-white">{item.key}</span>{' '}
                  <span className="text-slate-300">{t(`import.reason.${item.reason}`)}</span>
                  {item.count !== undefined && item.count > 1 && (
                    <span className="text-slate-400"> ×{format(item.count)}</span>
                  )}
                  {item.detail && (
                    <code className="ml-1 break-all text-slate-400 select-text">{item.detail}</code>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </details>
  );
}

/** A dry run's report (FR-IMP-2): counts, file expectations and mapped/unmapped items by area. */
export function ImportReportView({ report }: { report: ImportReport }) {
  const { t, i18n } = useTranslation();
  const format = (n: number) => n.toLocaleString(i18n.language);
  const files = Object.fromEntries(
    FILE_KEYS.map((key) => [key, report.systems.reduce((sum, row) => sum + row[key], 0)]),
  ) as Record<(typeof FILE_KEYS)[number], number>;
  return (
    <section aria-label={t('settings.import.reportTitle')} className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-white">{t('settings.import.reportTitle')}</h4>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        {[
          ...COUNT_KEYS.map((key) => [key, report.counts[key]] as const),
          ...FILE_KEYS.map((key) => [key, files[key]] as const),
        ].map(([key, value]) => (
          <div key={key} className="flex justify-between gap-2 border-b border-white/5 py-1">
            <dt className="text-slate-300">{t(`settings.import.count.${key}`)}</dt>
            <dd className="font-medium text-white">{format(value)}</dd>
          </div>
        ))}
      </dl>
      <ItemList items={report.unmapped} label={t('settings.import.unmapped')} open />
      <ItemList items={report.willReplace} label={t('settings.import.willReplace')} />
      <ItemList items={report.mapped} label={t('settings.import.mapped')} />
    </section>
  );
}
