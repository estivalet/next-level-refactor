import { UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useAuthState,
  useDevices,
  useRefreshEntitlement,
  useRevokeDevice,
  useSignOut,
} from '../auth/authApi.ts';
import { DeviceList } from '../auth/DeviceList.tsx';
import { SECONDARY } from '../auth/GateFrame.tsx';
import { errorMessageKey } from '../settings/settingsApi.ts';
import { BillingSection } from './BillingSection.tsx';

/** S12 Account (D24): profile, plan, last check with Refresh, devices with Revoke, Sign out. */
export function AccountApp() {
  const { t, i18n } = useTranslation();
  const auth = useAuthState();
  const state = auth.data;
  const signedIn = state?.kind === 'signedIn' ? state : null;
  const devices = useDevices(signedIn !== null);
  const revoke = useRevokeDevice();
  const refresh = useRefreshEntitlement();
  const signOut = useSignOut();
  const time = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );

  if (state?.kind === 'disabled') {
    return <p className="p-6 text-sm text-slate-400">{t('account.disabled')}</p>;
  }
  if (!signedIn) return null;
  const { user, entitlement } = signedIn;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto bg-[#0b0b0f] p-6 text-slate-300">
      <section className="flex items-center gap-4">
        {/* No Google avatar: the window loads no remote content (security §3, CSP img-src). */}
        <UserRound aria-hidden="true" className="h-12 w-12 rounded-full bg-white/5 p-2" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-white">{user.name}</p>
          <p className="truncate text-sm text-slate-400">{user.email}</p>
        </div>
        <button
          type="button"
          className={SECONDARY}
          disabled={signOut.isPending}
          onClick={() => {
            signOut.mutate();
          }}
        >
          {t('auth.signOut')}
        </button>
      </section>
      <section className="flex flex-col gap-1">
        <BillingSection entitlement={entitlement} />
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">
            {signedIn.offline
              ? t('auth.offlineUntil', { date: time(entitlement.offlineUntil) })
              : t('account.checked', { time: time(entitlement.checkedAt) })}
          </p>
          <button
            type="button"
            className={SECONDARY}
            disabled={refresh.isPending}
            onClick={() => {
              refresh.mutate();
            }}
          >
            {t('account.refresh')}
          </button>
        </div>
        {!signedIn.remembered && (
          <p className="text-xs text-amber-200">{t('account.notRemembered')}</p>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-white">{t('account.devices')}</h2>
        {devices.isError && (
          <p role="alert" className="text-sm text-[#ff8a80]">
            {t(errorMessageKey(devices.error))}
          </p>
        )}
        {devices.data && (
          <DeviceList
            devices={devices.data}
            label={t('account.devices')}
            actionLabel={t('account.revoke')}
            busy={revoke.isPending}
            onAction={(device) => {
              revoke.mutate(device.id);
            }}
          />
        )}
        {revoke.isError && (
          <p role="alert" className="text-sm text-[#ff8a80]">
            {t(errorMessageKey(revoke.error))}
          </p>
        )}
      </section>
    </div>
  );
}
