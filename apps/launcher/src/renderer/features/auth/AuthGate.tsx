import type { ReactNode } from 'react';
import { Splash } from '../boot/Splash.tsx';
import { DeviceLimitScreen, SubscribeScreen, SuspendedScreen } from './AccountScreens.tsx';
import { useAuthState } from './authApi.ts';
import { SignInScreen } from './SignInScreen.tsx';

/**
 * The gate layer (IA §1, F2): nothing of the launcher shows until the account may use it —
 * signed in with an active (or in-grace) entitlement, or sign-in turned off (D25). Local data is
 * never touched here.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuthState();
  const state = auth.data;
  if (!state || state.kind === 'checking') return <Splash labelKey="auth.checking" />;
  switch (state.kind) {
    case 'disabled':
      return children;
    case 'signedOut':
    case 'signingIn':
      return <SignInScreen state={state} />;
    case 'deviceLimit':
      return <DeviceLimitScreen state={state} />;
    case 'signedIn':
      if (state.entitlement.status === 'suspended') return <SuspendedScreen state={state} />;
      if (state.entitlement.status === 'none') return <SubscribeScreen state={state} />;
      return children;
  }
}
