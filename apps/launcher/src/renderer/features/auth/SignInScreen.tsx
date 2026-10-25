import type { AuthState } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { getBridge } from '../../bridge.ts';
import { useCancelSignIn, useSignIn } from './authApi.ts';
import { GateFrame, PRIMARY, SECONDARY } from './GateFrame.tsx';

type SignInState = Extract<AuthState, { kind: 'signedOut' } | { kind: 'signingIn' }>;

/** S2 Sign-in (US-A1): the system browser does the Google part; this screen waits for it. */
export function SignInScreen({ state }: { state: SignInState }) {
  const { t } = useTranslation();
  const signIn = useSignIn();
  const cancel = useCancelSignIn();
  const waiting = state.kind === 'signingIn';
  const reason = state.kind === 'signedOut' ? state.reason : null;
  const start = () => {
    signIn.mutate();
  };

  return (
    <GateFrame title={t('auth.intro')} banner={state.kind === 'signedOut' ? state.banner : null}>
      {reason && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(`auth.reason.${reason}`)}
        </p>
      )}
      {waiting ? (
        <div className="flex items-center gap-3">
          <p role="status" className="flex-1 text-sm text-slate-300">
            {t('auth.waiting')}
          </p>
          <button
            type="button"
            autoFocus
            className={SECONDARY}
            onClick={() => {
              cancel.mutate();
            }}
          >
            {t('auth.cancel')}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {/* Enter (or the gamepad's A, mapped to Enter) on the focused button signs in. */}
          <button type="button" autoFocus className={PRIMARY} onClick={start}>
            {reason ? t('auth.retry') : t('auth.signIn')}
          </button>
          <button
            type="button"
            className={SECONDARY}
            onClick={() => {
              void getBridge().invoke('app.quit');
            }}
          >
            {t('auth.quit')}
          </button>
        </div>
      )}
    </GateFrame>
  );
}
