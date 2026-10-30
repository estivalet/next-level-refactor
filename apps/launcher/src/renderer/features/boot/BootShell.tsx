import { useContext, type ReactNode } from 'react';
import { getApp } from '../../apps/registry.ts';
import { FRONTEND_CLOSED } from '../frontend/useFrontend.ts';
import { ShellProvider } from '../shell/ShellContext.tsx';
import type { Bounds, WindowAction } from '../shell/windowManager.ts';
import { BootRouteContext, SetupLandingContext } from './bootRoute.ts';

/**
 * The shell, starting in the front-end or on the desktop as BootGate decided (FR-THM-5), with the
 * Catalog open when the wizard ended on Browse catalog.
 */
export function BootShell({
  initialBounds,
  children,
}: {
  initialBounds: Bounds;
  children: ReactNode;
}) {
  const route = useContext(BootRouteContext);
  const landing = useContext(SetupLandingContext);
  const app = landing ? getApp(landing) : undefined;
  // After the wizard's Browse catalog: the desktop with the Catalog open on Browse (FR-ONB-2).
  const initialActions: WindowAction[] = app
    ? [
        {
          type: 'open',
          appId: app.id,
          size: app.defaultSize,
          singleInstance: app.singleInstance,
          params: { tab: 'browse' },
        },
      ]
    : [];
  return (
    <ShellProvider
      initialBounds={initialBounds}
      initialFrontend={app ? FRONTEND_CLOSED : route}
      initialActions={initialActions}
    >
      {children}
    </ShellProvider>
  );
}
