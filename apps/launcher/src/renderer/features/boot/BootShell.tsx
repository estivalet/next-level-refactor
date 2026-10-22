import { useContext, type ReactNode } from 'react';
import { ShellProvider } from '../shell/ShellContext.tsx';
import type { Bounds } from '../shell/windowManager.ts';
import { BootRouteContext } from './bootRoute.ts';

/** The shell, starting in the front-end or on the desktop as BootGate decided (FR-THM-5). */
export function BootShell({
  initialBounds,
  children,
}: {
  initialBounds: Bounds;
  children: ReactNode;
}) {
  const route = useContext(BootRouteContext);
  return (
    <ShellProvider initialBounds={initialBounds} initialFrontend={route}>
      {children}
    </ShellProvider>
  );
}
