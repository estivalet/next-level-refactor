import { AppErrorException, type AdminSubscription } from '@nextlevel/shared';
import { Button, Dialog, Table } from '@nextlevel/ui';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRevokeGrant } from '../api/hooks.ts';
import { usePlans } from '../api/plans.ts';
import { errorKey, formatTime } from '../errors.ts';
import { GrantDialog } from './GrantDialog.tsx';

const gives = (sub: AdminSubscription) => sub.status === 'active' || sub.status === 'past_due';

/** A grant that ended (or was revoked elsewhere) meanwhile gets its own message. */
const revokeErrorKey = (error: unknown) =>
  error instanceof AppErrorException &&
  (error.error.details as { reason?: unknown } | undefined)?.reason === 'notActive'
    ? 'admin.subscription.reasons.notActive'
    : errorKey(error);

/** S13 user detail → Subscription (FR-SUB-4, US-F2): the current one, the history, grants. */
export function SubscriptionPanel({
  userId,
  subscriptions,
}: {
  userId: string;
  subscriptions: readonly AdminSubscription[];
}) {
  const { t, i18n } = useTranslation();
  const plans = usePlans();
  const revoke = useRevokeGrant(userId);
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<AdminSubscription | null>(null);
  const grantButton = useRef<HTMLButtonElement>(null);
  const current = subscriptions.find(gives) ?? null;
  const choices = plans.data?.filter((plan) => !plan.archived) ?? [];
  // Why Grant can't be used: the plans didn't load, or every plan is archived.
  const blocked = plans.isError
    ? 'admin.subscription.plansFailed'
    : plans.data && choices.length === 0
      ? 'admin.subscription.noPlans'
      : null;
  const date = (iso: string | null) => formatTime(iso, i18n.language, '—');
  const end = (sub: AdminSubscription) => {
    if (sub.source === 'comp') {
      return sub.periodEnd
        ? t('admin.subscription.until', { date: date(sub.periodEnd) })
        : t('admin.subscription.untilRevoked');
    }
    if (!sub.periodEnd) return '';
    return t(sub.cancelAtPeriodEnd ? 'admin.subscription.ends' : 'admin.subscription.renews', {
      date: date(sub.periodEnd),
    });
  };
  const summary = (sub: AdminSubscription) =>
    [
      t(`admin.subscription.source.${sub.source}`),
      sub.plan.name,
      t(`admin.subscription.status.${sub.status}`),
      end(sub),
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <section aria-labelledby="subscription-title" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 id="subscription-title" className="text-sm font-semibold text-white">
          {t('admin.subscription.title')}
        </h2>
        <Button
          ref={grantButton}
          disabled={!plans.data || blocked !== null}
          aria-describedby={blocked ? 'grant-blocked' : undefined}
          onClick={() => {
            setGranting(true);
          }}
        >
          {t('admin.subscription.grant')}
        </Button>
        {blocked && (
          <p id="grant-blocked" className="text-xs text-slate-400">
            {t(blocked)}
          </p>
        )}
      </div>
      {current ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
          <span>{summary(current)}</span>
          {current.stripeSubscriptionId && (
            <span className="text-xs text-slate-400">
              {t('admin.subscription.stripeId')}{' '}
              <code className="select-all">{current.stripeSubscriptionId}</code>
            </span>
          )}
          {current.source === 'comp' && (
            <Button
              variant="danger"
              disabled={revoke.isPending}
              onClick={() => {
                setRevoking(current);
              }}
            >
              {t('admin.subscription.revoke')}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400">{t('admin.subscription.none')}</p>
      )}
      {revoke.error && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(revokeErrorKey(revoke.error))}
        </p>
      )}
      {subscriptions.length > 0 && (
        <Table
          label={t('admin.subscription.history')}
          columns={[
            t('admin.subscription.columns.source'),
            t('admin.subscription.columns.plan'),
            t('admin.subscription.columns.status'),
            t('admin.subscription.columns.end'),
            t('admin.subscription.columns.created'),
            t('admin.subscription.columns.by'),
            t('admin.subscription.columns.note'),
          ]}
          empty=""
          rows={subscriptions.map((sub) => ({
            key: sub.id,
            cells: [
              t(`admin.subscription.source.${sub.source}`),
              sub.plan.name,
              t(`admin.subscription.status.${sub.status}`),
              end(sub),
              date(sub.createdAt),
              sub.grantedBy?.email ?? '',
              sub.note ?? '',
            ],
          }))}
        />
      )}
      {granting && plans.data && (
        <GrantDialog
          userId={userId}
          plans={plans.data}
          onClose={() => {
            setGranting(false);
          }}
          onGranted={() => {
            revoke.reset();
          }}
        />
      )}
      {revoking && (
        <Dialog
          title={t('admin.subscription.revokeTitle')}
          onClose={() => {
            setRevoking(null);
          }}
          footer={
            <>
              <Button
                onClick={() => {
                  setRevoking(null);
                }}
              >
                {t('admin.subscription.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  // The Revoke button goes away with the grant: focus lands on Grant instead.
                  revoke.mutate(revoking.id, {
                    onSettled: () => {
                      grantButton.current?.focus();
                    },
                  });
                  setRevoking(null);
                }}
              >
                {t('admin.subscription.revoke')}
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-300">{t('admin.subscription.revokeBody')}</p>
        </Dialog>
      )}
    </section>
  );
}
