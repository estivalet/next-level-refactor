import { useEffect, useState } from 'react';
import { getApp } from '../../apps/registry.ts';
import { useFrontend } from '../frontend/useFrontend.ts';
import { useShell } from '../shell/ShellContext.tsx';
import { useKioskHides, useKioskHidesApp, useKioskLocked } from './kioskApi.ts';
import { PinPad } from './PinPad.tsx';
import { useHoldToUnlock } from './useHoldToUnlock.ts';

/**
 * Kiosk mode in the shell (US-D4, D54). While locked: with the desktop hidden the front-end stays
 * open (also when the boot target was the desktop, so it falls back to the last theme), and
 * holding Esc or Start for 3 seconds opens the PIN pad. Locking (Lock now, or a lock while the
 * owner had a window open) closes the windows of the apps it hides.
 */
export function KioskGate() {
  const locked = useKioskLocked();
  const hides = useKioskHides();
  const frontend = useFrontend();
  const [padOpen, setPadOpen] = useState(false);
  const desktopHidden = hides('desktop');
  const hidesApp = useKioskHidesApp();
  const { state: shell, dispatch } = useShell();

  useEffect(() => {
    for (const win of shell.windows) {
      const app = getApp(win.appId);
      if (app && hidesApp(app.id)) dispatch({ type: 'close', id: win.id });
    }
  }, [shell.windows, hidesApp, dispatch]);

  useEffect(() => {
    if (desktopHidden && !frontend.visible && frontend.preview === null) frontend.show();
  }, [desktopHidden, frontend]);

  useHoldToUnlock({
    enabled: locked && !padOpen,
    onHold: () => {
      setPadOpen(true);
    },
  });

  if (!padOpen || !locked) return null;
  return (
    <PinPad
      onClose={() => {
        setPadOpen(false);
      }}
      onUnlocked={() => {
        setPadOpen(false);
      }}
    />
  );
}
