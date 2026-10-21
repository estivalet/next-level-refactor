import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getApp } from '../../apps/registry.ts';
import { DesktopIcons } from './DesktopIcons.tsx';
import { useShell } from './ShellContext.tsx';
import { ShellWindow } from './ShellWindow.tsx';

/** The desktop: icons and windows in the work area, with an optional taskbar below. */
export function Desktop({ taskbar }: { taskbar?: ReactNode }) {
  const { t } = useTranslation();
  const { state, dispatch } = useShell();
  const workArea = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = workArea.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      dispatch({ type: 'setBounds', bounds: { width, height } });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [dispatch]);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#1e1b4b] font-sans text-slate-200 select-none">
      <main
        ref={workArea}
        aria-label={t('shell.desktop.label')}
        className="relative isolate flex-1 overflow-hidden"
      >
        <DesktopIcons />
        {state.windows.map((win) => {
          const app = getApp(win.appId);
          if (!app) return null;
          return (
            <ShellWindow key={win.id} win={win} title={t(app.titleKey)}>
              <app.Component />
            </ShellWindow>
          );
        })}
      </main>
      {taskbar}
    </div>
  );
}
