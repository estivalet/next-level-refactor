import { formatPrice, type PlanPrices } from '@nextlevel/shared';
import { Table } from '@nextlevel/ui';
import { useTranslation } from 'react-i18next';
import { usePlans, useScopes } from '../api/plans.ts';
import { errorKey } from '../errors.ts';
import { hrefOf } from '../router.ts';

/** S13 Plans (FR-ADM-2): every plan with its prices, devices, scopes and subscribers. */
export function PlansPage() {
  const { t, i18n } = useTranslation();
  const plans = usePlans();
  const scopes = useScopes();
  const scopeName = new Map((scopes.data ?? []).map((scope) => [scope.id, scope.name]));
  const prices = (value: PlanPrices) => {
    const parts = [
      value.month && t('admin.plans.month', { price: formatPrice(value.month, i18n.language) }),
      value.year && t('admin.plans.year', { price: formatPrice(value.year, i18n.language) }),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : t('admin.plans.noPrice');
  };
  const error = plans.error ?? scopes.error;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">{t('admin.plans.title')}</h1>
        <a
          href={hrefOf({ page: 'planNew' })}
          className="rounded-lg bg-[#990033] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#b3003c]"
        >
          {t('admin.plans.new')}
        </a>
      </div>
      {error && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(errorKey(error))}
        </p>
      )}
      <Table
        label={t('admin.plans.title')}
        columns={[
          t('admin.plans.name'),
          t('admin.plans.slug'),
          t('admin.plans.prices'),
          t('admin.plans.devices'),
          t('admin.plans.scopes'),
          t('admin.plans.subscribers'),
        ]}
        empty={plans.isSuccess ? t('admin.plans.empty') : ''}
        rows={(plans.data ?? []).map((plan) => ({
          key: plan.id,
          cells: [
            <span key="name" className="flex items-center gap-2">
              <a
                href={hrefOf({ page: 'plan', id: plan.id })}
                className="text-sky-300 hover:underline"
              >
                {plan.name}
              </a>
              {plan.archived && (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-slate-400">
                  {t('admin.plans.archived')}
                </span>
              )}
            </span>,
            <code key="slug">{plan.slug}</code>,
            prices(plan.prices),
            plan.deviceLimit,
            plan.scopeIds.map((id) => scopeName.get(id) ?? id).join(', '),
            plan.subscribers,
          ],
        }))}
      />
    </section>
  );
}
