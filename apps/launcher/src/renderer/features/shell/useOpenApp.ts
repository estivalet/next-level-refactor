import { useCallback } from 'react';
import { getApp, type AppId } from '../../apps/registry.ts';
import { useShell } from './ShellContext.tsx';

/** Opens an app in a window, or brings its window forward when it is single-instance. */
export function useOpenApp(): (id: AppId) => void {
  const { dispatch } = useShell();
  return useCallback(
    (id: AppId) => {
      const app = getApp(id);
      if (!app) return;
      dispatch({
        type: 'open',
        appId: id,
        size: app.defaultSize,
        singleInstance: app.singleInstance,
      });
    },
    [dispatch],
  );
}
