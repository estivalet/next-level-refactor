import { useEffect, useState } from 'react';
import { useFrontend } from '../frontend/useFrontend.ts';
import { useKioskHides, useKioskState } from './kioskApi.ts';
import { PinPad } from './PinPad.tsx';
import { useHoldToUnlock } from './useHoldToUnlock.ts';

/**
 * Kiosk mode in the shell (US-D4, D54). While locked: with the desktop hidden the front-end stays
 * open (also when the boot target was the desktop, so it falls back to the last theme), and
 * holding Esc or Start for 3 seconds opens the PIN pad.
 */
export function KioskGate() {
  const locked = useKioskState().data?.locked ?? false;
  const hides = useKioskHides();
  const frontend = useFrontend();
  const [padOpen, setPadOpen] = useState(false);
  const desktopHidden = hides('desktop');

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
