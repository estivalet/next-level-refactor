import { useCallback } from 'react';
import { getApp, type AppId } from '../../apps/registry.ts';
import { useShell } from './ShellContext.tsx';
import type { AppParams } from './windowManager.ts';

/**
 * Opens an app in a window, or brings its window forward when it is single-instance. `params`
 * tell the app what to show, also when its window was already open.
 */
export function useOpenApp(): (id: AppId, params?: AppParams) => void {
  const { dispatch } = useShell();
  return useCallback(
    (id: AppId, params?: AppParams) => {
      const app = getApp(id);
      if (!app) return;
      dispatch({
        type: 'open',
        appId: id,
        size: app.defaultSize,
        singleInstance: app.singleInstance,
        ...(params ? { params } : {}),
      });
    },
    [dispatch],
  );
}
