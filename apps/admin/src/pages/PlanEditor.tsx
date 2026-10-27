import { formatPrice, type AdminPlan, type CatalogScope, type Price } from '@nextlevel/shared';
import { Button, TextField } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreatePlan, usePlans, useScopes, useUpdatePlan } from '../api/plans.ts';
import { errorKey } from '../errors.ts';
import { hrefOf } from '../router.ts';
import { fieldErrors, type PlanField } from './planReasons.ts';

/** S13 Plans → New plan / plan detail (FR-ADM-2, US-F4). `id` null: a new plan. */
export function PlanEditor({ id }: { id: string | null }) {
  const { t } = useTranslation();
  const plans = usePlans();
  const scopes = useScopes();
  const [justSaved, setJustSaved] = useState(false);
  // A failed background refetch keeps the data it had: only a first load failure is shown.
  const error = (plans.data ? null : plans.error) ?? (scopes.data ? null : scopes.error);
  if (error) {
    return (
      <p role="alert" className="text-sm text-[#ff8a80]">
        {t(errorKey(error))}
      </p>
    );
  }
  if (!plans.data || !scopes.data) return null;
  const saved = id === null ? null : (plans.data.find((plan) => plan.id === id) ?? undefined);
  if (saved === undefined) return <p className="text-sm">{t('admin.plans.notFound')}</p>;
  // Remount when the saved plan changes, so the form starts from it.
  return (
    <PlanForm
      key={JSON.stringify(saved)}
      saved={saved}
      scopes={scopes.data}
      justSaved={justSaved}
      onSaved={() => {
        setJustSaved(true);
      }}
    />
  );
}

function PlanForm({
  saved,
  scopes,
  justSaved,
  onSaved,
}: {
  saved: AdminPlan | null;
  scopes: CatalogScope[];
  justSaved: boolean;
  onSaved: () => void;
}) {
  const { t, i18n } = useTranslation();
  const create = useCreatePlan();
  const update = useUpdatePlan(saved?.id ?? '');
  const save = saved ? update : create;
  const [slug, setSlug] = useState(saved?.slug ?? '');
  const [name, setName] = useState(saved?.name ?? '');
  const [devices, setDevices] = useState(String(saved?.deviceLimit ?? 3));
  const [scopeIds, setScopeIds] = useState<string[]>(saved?.scopeIds ?? []);
  const [monthly, setMonthly] = useState(saved?.stripePriceMonthly ?? '');
  const [yearly, setYearly] = useState(saved?.stripePriceYearly ?? '');
  const [archived, setArchived] = useState(saved?.archived ?? false);

  const deviceLimit = Number(devices);
  const priceMonthly = monthly.trim() || null;
  const priceYearly = yearly.trim() || null;
  const sameScopes = [...scopeIds].sort().join() === [...(saved?.scopeIds ?? [])].sort().join();
  const patch = {
    ...(name.trim() !== saved?.name ? { name: name.trim() } : {}),
    ...(deviceLimit !== saved?.deviceLimit ? { deviceLimit } : {}),
    ...(sameScopes ? {} : { scopeIds }),
    ...(priceMonthly !== saved?.stripePriceMonthly ? { stripePriceMonthly: priceMonthly } : {}),
    ...(priceYearly !== saved?.stripePriceYearly ? { stripePriceYearly: priceYearly } : {}),
    ...(saved && archived !== saved.archived ? { archived } : {}),
  };
  const valid =
    name.trim() !== '' &&
    Number.isInteger(deviceLimit) &&
    deviceLimit >= 1 &&
    deviceLimit <= 20 &&
    (saved !== null || /^[a-z0-9-]{2,40}$/.test(slug));
  const changed = saved ? Object.keys(patch).length > 0 : slug !== '' || name !== '';
  const errors = fieldErrors(save.error, {
    priceMonthly: priceMonthly !== (saved?.stripePriceMonthly ?? null),
    priceYearly: priceYearly !== (saved?.stripePriceYearly ?? null),
  });
  const fieldError = (field: PlanField) => {
    const found = errors[field];
    if (!found) return null;
    const values = Object.fromEntries(
      Object.entries(found.values ?? {}).map(([key, value]) => [key, t(value)]),
    );
    return t(found.key, values);
  };
  const otherError = save.error && Object.keys(errors).length === 0 ? save.error : null;
  const stored = (price: Price | null | undefined) =>
    price ? `${t('admin.plans.stored', { price: formatPrice(price, i18n.language) })} ` : '';

  const submit = () => {
    if (saved) {
      // The saved plan remounts this form, so the call's own onSuccess would never run.
      update.mutateAsync(patch).then(onSaved, () => undefined);
      return;
    }
    create.mutate(
      {
        slug,
        name: name.trim(),
        deviceLimit,
        scopeIds,
        stripePriceMonthly: priceMonthly,
        stripePriceYearly: priceYearly,
      },
      {
        onSuccess: (plan) => {
          window.location.hash = hrefOf({ page: 'plan', id: plan.id });
        },
      },
    );
  };

  return (
    <form
      className="flex max-w-xl flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <a href={hrefOf({ page: 'plans' })} className="text-sm text-sky-300 hover:underline">
        {t('admin.plans.back')}
      </a>
      <h1 className="text-lg font-semibold text-white">
        {saved?.name ?? t('admin.plans.newTitle')}
      </h1>
      <TextField
        label={t('admin.plans.slug')}
        help={t('admin.plans.slugHelp')}
        value={slug}
        readOnly={saved !== null}
        error={fieldError('slug')}
        onChange={(event) => {
          setSlug(event.target.value);
        }}
      />
      <TextField
        label={t('admin.plans.name')}
        maxLength={60}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <TextField
        label={t('admin.plans.deviceLimit')}
        type="number"
        min={1}
        max={20}
        value={devices}
        onChange={(event) => {
          setDevices(event.target.value);
        }}
      />
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs font-medium text-slate-300">
          {t('admin.plans.scopes')}
        </legend>
        {scopes.length === 0 && (
          <p className="text-sm text-slate-500">{t('admin.plans.noScopes')}</p>
        )}
        {scopes.map((scope) => (
          <label key={scope.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={scopeIds.includes(scope.id)}
              onChange={(event) => {
                setScopeIds((ids) =>
                  event.target.checked ? [...ids, scope.id] : ids.filter((x) => x !== scope.id),
                );
              }}
            />
            {scope.name}
          </label>
        ))}
      </fieldset>
      <TextField
        label={t('admin.plans.priceMonthly')}
        help={`${stored(saved?.prices.month)}${t('admin.plans.priceHelp')}`}
        value={monthly}
        error={fieldError('priceMonthly')}
        onChange={(event) => {
          setMonthly(event.target.value);
        }}
      />
      <TextField
        label={t('admin.plans.priceYearly')}
        help={`${stored(saved?.prices.year)}${t('admin.plans.priceHelp')}`}
        value={yearly}
        error={fieldError('priceYearly')}
        onChange={(event) => {
          setYearly(event.target.value);
        }}
      />
      {saved && (
        <ArchivedBox
          checked={archived}
          error={fieldError('archived')}
          onChange={(value) => {
            setArchived(value);
          }}
        />
      )}
      {otherError && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(errorKey(otherError))}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={!changed || !valid || save.isPending}>
          {t('admin.plans.save')}
        </Button>
        {justSaved && !changed && (
          <p role="status" className="text-sm text-emerald-300">
            {t('admin.plans.saved')}
          </p>
        )}
      </div>
    </form>
  );
}

function ArchivedBox({
  checked,
  error,
  onChange,
}: {
  checked: boolean;
  error: string | null;
  onChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked}
          aria-invalid={error ? true : undefined}
          aria-describedby="plan-archived-help"
          onChange={(event) => {
            onChange(event.target.checked);
          }}
        />
        {t('admin.plans.archived')}
      </label>
      <p
        id="plan-archived-help"
        className={`text-xs ${error ? 'text-[#ff8a80]' : 'text-slate-500'}`}
      >
        {error ?? t('admin.plans.archivedHelp')}
      </p>
    </div>
  );
}
