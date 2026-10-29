import { CATALOG_SLUG_MAX, safeSlug } from '@nextlevel/shared';
import { systemCatalog } from '@nextlevel/system-catalog';
import { Button, Select, TextField } from '@nextlevel/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateItem } from '../../api/catalog.ts';
import { useScopes } from '../../api/plans.ts';
import { hrefOf } from '../../router.ts';
import { catalogErrorKey, reasonOf } from './catalogText.ts';

/** S13 Catalog → New item (FR-ADM-3): slug, title, system and scope; then its editor opens. */
export function NewItemPage() {
  const { t } = useTranslation();
  const scopes = useScopes();
  const create = useCreateItem();
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [systemId, setSystemId] = useState('');
  const [scopeSlug, setScopeSlug] = useState<string | null>(null);
  const systems = useMemo(
    () => [...systemCatalog()].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  if (!scopes.data) return null;
  const scope = scopeSlug ?? scopes.data[0]?.slug ?? '';
  const slugOk = safeSlug(slug);
  const valid = slugOk && title.trim() !== '' && systemId !== '' && scope !== '';
  const reason = reasonOf(create.error);
  const fieldError = (field: 'slug' | 'system' | 'scope') => {
    const mine = field === 'slug' ? reason === 'slugTaken' : reason === field;
    return mine ? t(catalogErrorKey(create.error)) : null;
  };
  const otherError =
    create.error && !['slugTaken', 'system', 'scope'].includes(reason ?? '') ? create.error : null;

  return (
    <form
      className="flex max-w-xl flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate(
          { slug, title: title.trim(), systemId, scopeSlug: scope },
          {
            onSuccess: (item) => {
              window.location.hash = hrefOf({ page: 'catalogItem', id: item.id, tab: 'metadata' });
            },
          },
        );
      }}
    >
      <a href={hrefOf({ page: 'catalog' })} className="text-sm text-sky-300 hover:underline">
        {t('admin.catalog.back')}
      </a>
      <h1 className="text-lg font-semibold text-white">{t('admin.catalog.newTitle')}</h1>
      {scopes.data.length === 0 ? (
        <p className="text-sm text-slate-400">
          {t('admin.catalog.noScopes')}{' '}
          <a href={hrefOf({ page: 'scopes' })} className="text-sky-300 hover:underline">
            {t('admin.nav.scopes')}
          </a>
        </p>
      ) : null}
      <TextField
        label={t('admin.catalog.fields.slug')}
        help={t('admin.catalog.fields.slugHelp')}
        value={slug}
        maxLength={CATALOG_SLUG_MAX}
        error={fieldError('slug') ?? (slug !== '' && !slugOk ? t('admin.catalog.badSlug') : null)}
        onChange={(event) => {
          setSlug(event.target.value);
        }}
      />
      <TextField
        label={t('admin.catalog.fields.title')}
        value={title}
        maxLength={200}
        onChange={(event) => {
          setTitle(event.target.value);
        }}
      />
      <Select
        label={t('admin.catalog.fields.system')}
        value={systemId}
        onChange={(event) => {
          setSystemId(event.target.value);
        }}
        options={[
          { value: '', label: t('admin.catalog.pickSystem') },
          ...systems.map((system) => ({ value: system.id, label: system.name })),
        ]}
      />
      {fieldError('system') && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {fieldError('system')}
        </p>
      )}
      <Select
        label={t('admin.catalog.fields.scope')}
        value={scope}
        onChange={(event) => {
          setScopeSlug(event.target.value);
        }}
        options={scopes.data.map((item) => ({ value: item.slug, label: item.name }))}
      />
      {fieldError('scope') && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {fieldError('scope')}
        </p>
      )}
      {otherError && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(catalogErrorKey(otherError))}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" disabled={!valid || create.isPending}>
          {t('admin.catalog.create')}
        </Button>
      </div>
    </form>
  );
}
