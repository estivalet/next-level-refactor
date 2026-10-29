import { useTranslation } from 'react-i18next';
import { useCatalogItem } from '../../api/catalog.ts';
import { errorKey } from '../../errors.ts';
import { CATALOG_TABS, hrefOf, type CatalogTab } from '../../router.ts';
import { ArtTab } from './ArtTab.tsx';
import { systemName } from './catalogText.ts';
import { FilesTab } from './FilesTab.tsx';
import { LicenseTab } from './LicenseTab.tsx';
import { MetadataTab } from './MetadataTab.tsx';
import { PublishTab } from './PublishTab.tsx';

/** S13 Catalog → item editor (FR-ADM-3, US-F1): Metadata · Files · Art · License · Publish. */
export function ItemEditor({ id, tab }: { id: string; tab: CatalogTab }) {
  const { t } = useTranslation();
  const query = useCatalogItem(id);
  // A failed background refetch keeps the data it had: only a first load failure is shown.
  if (!query.data) {
    return query.error ? (
      <p role="alert" className="text-sm text-[#ff8a80]">
        {t(errorKey(query.error))}
      </p>
    ) : null;
  }
  const item = query.data;
  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <a href={hrefOf({ page: 'catalog' })} className="text-sm text-sky-300 hover:underline">
        {t('admin.catalog.back')}
      </a>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-lg font-semibold text-white">{item.title}</h1>
        <span className="text-sm text-slate-400">
          {systemName(item.systemId)} · {item.slug} · v{item.version}
        </span>
        <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-slate-200">
          {t(`admin.catalog.status.${item.status}`)}
        </span>
      </div>
      <nav
        aria-label={t('admin.catalog.tabs.label')}
        className="flex gap-1 border-b border-white/10"
      >
        {CATALOG_TABS.map((name) => (
          <a
            key={name}
            href={hrefOf({ page: 'catalogItem', id, tab: name })}
            aria-current={name === tab ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${name === tab ? 'border-sky-400 text-white' : 'border-transparent hover:text-white'}`}
          >
            {t(`admin.catalog.tabs.${name}`)}
          </a>
        ))}
      </nav>
      {tab === 'metadata' && <MetadataTab key={item.id} item={item} />}
      {tab === 'files' && <FilesTab item={item} />}
      {tab === 'art' && <ArtTab item={item} />}
      {tab === 'license' && <LicenseTab key={item.license?.id ?? 'none'} item={item} />}
      {tab === 'publish' && <PublishTab item={item} />}
    </section>
  );
}
