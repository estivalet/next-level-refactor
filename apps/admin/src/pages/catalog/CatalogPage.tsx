import { ITEM_STATUS } from '@nextlevel/shared';
import { Button, Select, Table, TextField } from '@nextlevel/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalogItems } from '../../api/catalog.ts';
import { useScopes } from '../../api/plans.ts';
import { errorKey } from '../../errors.ts';
import { hrefOf } from '../../router.ts';
import { systemName } from './catalogText.ts';

/** S13 Catalog (FR-ADM-3): search, status and scope filters, newest first, Load more. */
export function CatalogPage() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [scope, setScope] = useState('');
  const scopes = useScopes();
  // The search runs when typing pauses for 300 ms.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(text.trim());
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [text]);
  const items = useCatalogItems({ q, status, scope });
  const rows = items.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">{t('admin.catalog.title')}</h1>
        <a
          href={hrefOf({ page: 'catalogNew' })}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-500"
        >
          {t('admin.catalog.new')}
        </a>
      </div>
      <div className="flex items-end gap-3">
        <div className="w-72">
          <TextField
            label={t('admin.catalog.search')}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
        </div>
        <Select
          label={t('admin.catalog.statusFilter')}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
          }}
          options={[
            { value: '', label: t('admin.catalog.all') },
            ...ITEM_STATUS.map((value) => ({
              value,
              label: t(`admin.catalog.status.${value}`),
            })),
          ]}
        />
        <Select
          label={t('admin.catalog.scopeFilter')}
          value={scope}
          onChange={(event) => {
            setScope(event.target.value);
          }}
          options={[
            { value: '', label: t('admin.catalog.all') },
            ...(scopes.data ?? []).map((item) => ({ value: item.slug, label: item.name })),
          ]}
        />
      </div>
      {items.isError && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(errorKey(items.error))}
        </p>
      )}
      <Table
        label={t('admin.catalog.title')}
        columns={[
          t('admin.catalog.columns.title'),
          t('admin.catalog.columns.system'),
          t('admin.catalog.columns.scope'),
          t('admin.catalog.columns.license'),
          t('admin.catalog.columns.status'),
          t('admin.catalog.columns.version'),
        ]}
        empty={items.isSuccess ? t('admin.catalog.empty') : ''}
        rows={rows.map((row) => ({
          key: row.id,
          cells: [
            <a
              key="title"
              href={hrefOf({ page: 'catalogItem', id: row.id, tab: 'metadata' })}
              className="text-sky-300 hover:underline"
            >
              {row.title}
            </a>,
            systemName(row.systemId),
            row.scopeSlug,
            t(`admin.catalog.licenseState.${row.licenseState}`),
            t(`admin.catalog.status.${row.status}`),
            row.version,
          ],
        }))}
      />
      {items.hasNextPage && (
        <div>
          <Button
            disabled={items.isFetchingNextPage}
            onClick={() => {
              void items.fetchNextPage();
            }}
          >
            {t('admin.catalog.loadMore')}
          </Button>
        </div>
      )}
    </section>
  );
}
