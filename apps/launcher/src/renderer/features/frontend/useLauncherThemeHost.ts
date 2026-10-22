import type { AppError, Settings } from '@nextlevel/shared';
import type { ThemeHost } from '@nextlevel/themes';
import { useLayoutEffect, useRef, useState } from 'react';
import { getBridge } from '../../bridge.ts';
import { createLauncherThemeHost } from './LauncherThemeHost.ts';

/**
 * One ThemeHost for the front-end's lifetime (the engine keeps its level and focus with it). It
 * reads the latest settings, translations and failure reporter through a ref.
 */
export function useLauncherThemeHost(deps: {
  settings: Settings;
  t: (key: string) => string;
  report: (gameId: number, error: AppError) => void;
}): ThemeHost {
  const latest = useRef(deps);
  useLayoutEffect(() => {
    latest.current = deps;
  });
  const [host] = useState(() =>
    createLauncherThemeHost(getBridge(), {
      settings: () => latest.current.settings,
      t: (key) => latest.current.t(key),
      onLaunchError: (gameId, error) => {
        latest.current.report(gameId, error);
      },
    }),
  );
  return host;
}
