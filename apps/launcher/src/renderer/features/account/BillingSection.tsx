import type { Entitlement } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { useOpenPortal } from '../auth/authApi.ts';
import { SECONDARY } from '../auth/GateFrame.tsx';
import { errorMessageKey } from '../settings/settingsApi.ts';

/**
 * S12 Account → plan line (FR-SUB-2): what pays for access and until when, with Manage billing
 * for Stripe subscriptions. With billing off (no `subscription` at all) it is the M7 line.
 */
export function BillingSection({ entitlement }: { entitlement: Entitlement }) {
  const { t, i18n } = useTranslation();
  const portal = useOpenPortal();
  const { plan, subscription } = entitlement;
  const date = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso));

  if (subscription === undefined) {
    return (
      <p className="text-sm text-slate-200">
        {plan ? t('account.plan', { plan: plan.name }) : t('account.admin')}
      </p>
    );
  }
  if (!plan || subscription === null) {
    return (
      <p className="text-sm text-slate-200">
        {entitlement.role === 'admin' ? t('account.admin') : t('account.billing.none')}
      </p>
    );
  }
  if (subscription.source === 'comp') {
    return (
      <p className="text-sm text-slate-200">
        {subscription.periodEnd
          ? t('account.billing.compUntil', { plan: plan.name, date: date(subscription.periodEnd) })
          : t('account.billing.compOpen', { plan: plan.name })}
      </p>
    );
  }
  const interval = t(
    subscription.interval === 'year' ? 'account.billing.year' : 'account.billing.month',
  );
  const line = subscription.periodEnd
    ? t(subscription.cancelAtPeriodEnd ? 'account.billing.ends' : 'account.billing.renews', {
        plan: plan.name,
        interval,
        date: date(subscription.periodEnd),
      })
    : plan.name;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-200">{line}</p>
      {subscription.status === 'past_due' && (
        <p role="alert" className="text-sm text-amber-200">
          {t('account.billing.pastDue')}
        </p>
      )}
      <div>
        <button
          type="button"
          className={SECONDARY}
          disabled={portal.isPending}
          onClick={() => {
            portal.mutate();
          }}
        >
          {t('account.billing.manage')}
        </button>
      </div>
      {portal.isError && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(errorMessageKey(portal.error))}
        </p>
      )}
    </div>
  );
}
