import type { AppError, MenuDraft, Settings } from '@nextlevel/shared';
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
  launching: (gameId: number) => void;
  /** Menu Editor preview (US-D5): a host over this unsaved menu, for the host's lifetime. */
  previewDraft?: MenuDraft | undefined;
}): ThemeHost {
  const latest = useRef(deps);
  useLayoutEffect(() => {
    latest.current = deps;
  });
  const [host] = useState(() =>
    createLauncherThemeHost(getBridge(), {
      settings: () => latest.current.settings,
      t: (key) => latest.current.t(key),
      onLaunching: (gameId) => {
        latest.current.launching(gameId);
      },
      onLaunchError: (gameId, error) => {
        latest.current.report(gameId, error);
      },
      ...(deps.previewDraft
        ? { previewDraft: () => latest.current.previewDraft ?? { title: '', nodes: [] } }
        : {}),
    }),
  );
  return host;
}
