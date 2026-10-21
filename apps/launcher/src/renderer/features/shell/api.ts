import { useCallback } from 'react';
import { getBridge } from '../../bridge.ts';

/** Asks main to quit the launcher. */
export function useQuitApp(): () => void {
  return useCallback(() => {
    void getBridge().invoke('app.quit');
  }, []);
}
