import type { AuthState, BillingInterval } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessageKey } from '../settings/settingsApi.ts';
import { SignOutButton } from './AccountScreens.tsx';
import { useOpenCheckout, usePlans, useRefreshEntitlement, useStopWaiting } from './authApi.ts';
import { GateFrame, SECONDARY } from './GateFrame.tsx';
import { PlanCard } from './PlanCard.tsx';

type SignedIn = Extract<AuthState, { kind: 'signedIn' }>;

const TOGGLE = (pressed: boolean) =>
  `rounded-md px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none ${
    pressed ? 'bg-white/20 text-white' : 'text-slate-300 hover:bg-white/10'
  }`;

function Waiting() {
  const { t } = useTranslation();
  const refresh = useRefreshEntitlement();
  const stop = useStopWaiting();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-white">{t('auth.subscribe.waiting')}</p>
      <div
        role="progressbar"
        aria-label={t('auth.subscribe.waiting')}
        className="h-1 w-full overflow-hidden rounded bg-white/10"
      >
        <div className="h-full w-1/3 animate-pulse rounded bg-[#990033]" />
      </div>
      <p className="text-xs text-slate-400">{t('auth.subscribe.waitingHint')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          autoFocus
          className={SECONDARY}
          disabled={refresh.isPending}
          onClick={() => {
            refresh.mutate();
          }}
        >
          {t('auth.subscribe.paid')}
        </button>
        <button
          type="button"
          className={SECONDARY}
          onClick={() => {
            stop.mutate();
          }}
        >
          {t('auth.subscribe.another')}
        </button>
      </div>
    </div>
  );
}

/**
 * S3 Subscribe (US-A2, IA F7): the plans on sale with a Month/Year toggle; Choose opens Stripe
 * Checkout in the browser and the screen waits until main sees the payment. With billing off
 * nobody should land here, so it keeps the "not open yet" notice (D21).
 */
export function SubscribeScreen({ state }: { state: SignedIn }) {
  const { t } = useTranslation();
  const plans = usePlans();
  const checkout = useOpenCheckout();
  const [interval, setPeriod] = useState<BillingInterval>('month');

  if (plans.data && !plans.data.billingEnabled) {
    return (
      <GateFrame title={t('auth.subscribe.title')} banner={state.banner}>
        <p className="text-sm text-slate-300">
          {t('auth.subscribe.body', { email: state.user.email })}
        </p>
        <div>
          <SignOutButton />
        </div>
      </GateFrame>
    );
  }

  const list = plans.data?.plans ?? [];
  const firstChoosable = list.findIndex((plan) => plan.prices[interval] !== null);
  const error = plans.error ?? checkout.error;
  return (
    <GateFrame title={t('auth.subscribe.choose')} banner={state.banner}>
      {state.waitingForPayment ? (
        <Waiting />
      ) : (
        <>
          <p className="text-sm text-slate-300">{t('auth.subscribe.intro')}</p>
          <div role="group" aria-label={t('auth.subscribe.period')} className="flex gap-1">
            {(['month', 'year'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={interval === value}
                className={TOGGLE(interval === value)}
                onClick={() => {
                  setPeriod(value);
                }}
              >
                {t(`auth.subscribe.${value}`)}
              </button>
            ))}
          </div>
          {plans.isPending && (
            <p className="text-sm text-slate-400">{t('auth.subscribe.loading')}</p>
          )}
          {plans.data && list.length === 0 && (
            <p className="text-sm text-slate-400">{t('auth.subscribe.none')}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((plan, index) => (
              <PlanCard
                key={plan.slug}
                plan={plan}
                interval={interval}
                busy={checkout.isPending}
                autoFocus={index === firstChoosable}
                onChoose={() => {
                  checkout.mutate({ planSlug: plan.slug, interval });
                }}
              />
            ))}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(errorMessageKey(error))}
        </p>
      )}
      {plans.isError && (
        <div>
          <button
            type="button"
            autoFocus
            className={SECONDARY}
            disabled={plans.isFetching}
            onClick={() => {
              void plans.refetch();
            }}
          >
            {t('auth.retry')}
          </button>
        </div>
      )}
      <div>
        <SignOutButton autoFocus={false} />
      </div>
    </GateFrame>
  );
}
