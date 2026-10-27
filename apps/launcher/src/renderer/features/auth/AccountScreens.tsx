import type { AuthState } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { useResolveDeviceLimit, useSignOut } from './authApi.ts';
import { DeviceList } from './DeviceList.tsx';
import { GateFrame, SECONDARY } from './GateFrame.tsx';

type SignedIn = Extract<AuthState, { kind: 'signedIn' }>;

export function SignOutButton({ autoFocus = true }: { autoFocus?: boolean }) {
  const { t } = useTranslation();
  const signOut = useSignOut();
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      disabled={signOut.isPending}
      className={SECONDARY}
      onClick={() => {
        signOut.mutate();
      }}
    >
      {t('auth.signOut')}
    </button>
  );
}

/** FR-AUTH-7: locks the launcher; local data stays as it is. */
export function SuspendedScreen({ state }: { state: SignedIn }) {
  const { t } = useTranslation();
  return (
    <GateFrame title={t('auth.suspended.title')} banner={state.banner}>
      <p className="text-sm text-slate-300">
        {t('auth.suspended.body', { email: state.user.email })}
      </p>
      <div>
        <SignOutButton />
      </div>
    </GateFrame>
  );
}

/** US-A4: every device slot is used; removing one finishes the sign-in. */
export function DeviceLimitScreen({
  state,
}: {
  state: Extract<AuthState, { kind: 'deviceLimit' }>;
}) {
  const { t } = useTranslation();
  const resolve = useResolveDeviceLimit();
  const signOut = useSignOut();
  return (
    <GateFrame title={t('auth.deviceLimit.title')} banner={null}>
      <p className="text-sm text-slate-300">{t('auth.deviceLimit.body')}</p>
      <DeviceList
        devices={state.devices}
        label={t('account.devices')}
        actionLabel={t('auth.deviceLimit.remove')}
        busy={resolve.isPending}
        focusFirst
        onAction={(device) => {
          resolve.mutate(device.id);
        }}
      />
      <div>
        <button
          type="button"
          className={SECONDARY}
          onClick={() => {
            signOut.mutate();
          }}
        >
          {t('auth.cancel')}
        </button>
      </div>
    </GateFrame>
  );
}
