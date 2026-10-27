import type { BillingInterval, Price, PublicPlan } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { PRIMARY } from './GateFrame.tsx';

/** Minor units → the locale's currency text (Global Constraints: money). */
export function formatPrice(price: Price, locale: string): string {
  const format = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: price.currency.toUpperCase(),
  });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(price.amount / 10 ** digits);
}

/** One plan on the Subscribe screen (S3): price for the chosen period, devices, scopes. */
export function PlanCard({
  plan,
  interval,
  busy,
  autoFocus,
  onChoose,
}: {
  plan: PublicPlan;
  interval: BillingInterval;
  busy: boolean;
  autoFocus: boolean;
  onChoose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const price = plan.prices[interval];
  const titleId = `plan-${plan.slug}`;
  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4"
    >
      <h2 id={titleId} className="text-base font-semibold text-white">
        {plan.name}
      </h2>
      <p className="text-sm text-slate-200">
        {price
          ? t(interval === 'month' ? 'auth.subscribe.perMonth' : 'auth.subscribe.perYear', {
              price: formatPrice(price, i18n.language),
            })
          : t(interval === 'month' ? 'auth.subscribe.yearlyOnly' : 'auth.subscribe.monthlyOnly')}
      </p>
      <p className="text-xs text-slate-400">
        {t('auth.subscribe.devices', { count: plan.deviceLimit })}
      </p>
      {plan.scopes.length > 0 && (
        <ul className="flex flex-wrap gap-1 text-xs text-slate-300">
          {plan.scopes.map((scope) => (
            <li key={scope.slug} className="rounded bg-white/10 px-2 py-0.5">
              {scope.name}
            </li>
          ))}
        </ul>
      )}
      <div>
        <button
          type="button"
          className={PRIMARY}
          autoFocus={autoFocus}
          disabled={!price || busy}
          aria-label={t('auth.subscribe.choosePlan', { plan: plan.name })}
          onClick={onChoose}
        >
          {t('auth.subscribe.chooseShort')}
        </button>
      </div>
    </article>
  );
}
