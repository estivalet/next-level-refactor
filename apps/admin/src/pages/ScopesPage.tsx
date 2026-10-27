import { AppErrorException, type CatalogScope } from '@nextlevel/shared';
import { Button, TextField } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateScope, useScopes, useUpdateScope } from '../api/plans.ts';
import { errorKey } from '../errors.ts';

const slugTaken = (error: unknown) =>
  error instanceof AppErrorException &&
  (error.error.details as { reason?: unknown } | undefined)?.reason === 'slugTaken';

/** S13 Catalog scopes (US-F4, D37): edit names and descriptions in place, add new ones. */
export function ScopesPage() {
  const { t } = useTranslation();
  const scopes = useScopes();
  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-lg font-semibold text-white">{t('admin.scopes.title')}</h1>
      <p className="text-sm text-slate-400">{t('admin.scopes.intro')}</p>
      {scopes.isError && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(errorKey(scopes.error))}
        </p>
      )}
      {scopes.isSuccess && scopes.data.length === 0 && (
        <p className="text-sm text-slate-500">{t('admin.scopes.empty')}</p>
      )}
      {scopes.data?.map((scope) => (
        <ScopeRow key={JSON.stringify(scope)} scope={scope} />
      ))}
      <NewScope />
    </section>
  );
}

function ScopeRow({ scope }: { scope: CatalogScope }) {
  const { t } = useTranslation();
  const update = useUpdateScope(scope.id);
  const [name, setName] = useState(scope.name);
  const [description, setDescription] = useState(scope.description);
  const patch = {
    ...(name.trim() !== scope.name ? { name: name.trim() } : {}),
    ...(description.trim() !== scope.description ? { description: description.trim() } : {}),
  };
  const changed = Object.keys(patch).length > 0;
  return (
    <fieldset
      aria-label={scope.slug}
      className="grid grid-cols-[1fr_2fr_auto] items-end gap-3 rounded-lg border border-white/10 p-3"
    >
      <TextField
        label={t('admin.scopes.name')}
        maxLength={60}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <TextField
        label={t('admin.scopes.description')}
        help={scope.slug}
        maxLength={500}
        value={description}
        error={update.error ? t(errorKey(update.error)) : null}
        onChange={(event) => {
          setDescription(event.target.value);
        }}
      />
      <Button
        disabled={!changed || name.trim() === '' || update.isPending}
        onClick={() => {
          update.mutate(patch);
        }}
      >
        {t('admin.scopes.save')}
      </Button>
    </fieldset>
  );
}

function NewScope() {
  const { t } = useTranslation();
  const create = useCreateScope();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const valid = /^[a-z0-9-]{2,40}$/.test(slug) && name.trim() !== '';
  return (
    <fieldset
      aria-label={t('admin.scopes.new')}
      className="grid grid-cols-[1fr_1fr_2fr_auto] items-end gap-3 rounded-lg border border-dashed border-white/15 p-3"
    >
      <TextField
        label={t('admin.scopes.slug')}
        value={slug}
        error={slugTaken(create.error) ? t('admin.plans.reasons.slugTaken') : null}
        onChange={(event) => {
          setSlug(event.target.value);
        }}
      />
      <TextField
        label={t('admin.scopes.name')}
        maxLength={60}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <TextField
        label={t('admin.scopes.description')}
        maxLength={500}
        value={description}
        error={create.error && !slugTaken(create.error) ? t(errorKey(create.error)) : null}
        onChange={(event) => {
          setDescription(event.target.value);
        }}
      />
      <Button
        variant="primary"
        disabled={!valid || create.isPending}
        onClick={() => {
          create.mutate(
            { slug, name: name.trim(), description: description.trim() },
            {
              onSuccess: () => {
                setSlug('');
                setName('');
                setDescription('');
              },
            },
          );
        }}
      >
        {t('admin.scopes.add')}
      </Button>
    </fieldset>
  );
}
