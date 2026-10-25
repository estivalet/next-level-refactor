import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getApp } from '../../apps/registry.ts';
import { BannerStrip } from '../auth/BannerStrip.tsx';
import { OfflineBadge } from '../auth/OfflineBadge.tsx';
import { FrontendLayer } from '../frontend/FrontendLayer.tsx';
import { MenuPreviewLayer } from '../frontend/MenuPreviewLayer.tsx';
import { useFrontend } from '../frontend/useFrontend.ts';
import { DesktopIcons } from './DesktopIcons.tsx';
import { useShell } from './ShellContext.tsx';
import { ShellWindow } from './ShellWindow.tsx';

/**
 * The desktop: icons and windows in the work area, with an optional taskbar below, and the
 * front-end layer above it all once opened (the shell is inert while the front-end shows).
 */
export function Desktop({ taskbar }: { taskbar?: ReactNode }) {
  const { t } = useTranslation();
  const { state, dispatch } = useShell();
  const frontend = useFrontend();
  const workArea = useRef<HTMLDivElement>(null);
  const covered = frontend.visible || frontend.preview !== null;
  const previousFocusedId = useRef(state.focusedId);

  // When the last visible window closes or minimizes, keyboard focus returns to the desktop.
  useEffect(() => {
    const hadFocus = previousFocusedId.current !== null;
    previousFocusedId.current = state.focusedId;
    if (!hadFocus || state.focusedId !== null) return;
    const active = document.activeElement;
    if (active && active !== document.body && !active.closest('[hidden]')) return;
    workArea.current?.querySelector<HTMLElement>('nav button')?.focus();
  }, [state.focusedId]);

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
      <div inert={covered} className="contents">
        <BannerStrip />
      </div>
      <main
        ref={workArea}
        inert={covered}
        aria-label={t('shell.desktop.label')}
        className="relative isolate flex-1 overflow-hidden"
      >
        <DesktopIcons />
        {state.windows.map((win) => {
          const app = getApp(win.appId);
          if (!app) return null;
          return (
            <ShellWindow key={win.id} win={win} title={t(app.titleKey)}>
              <app.Component {...(win.params ? { params: win.params } : {})} />
            </ShellWindow>
          );
        })}
      </main>
      {taskbar && (
        <div inert={covered} className="contents">
          {taskbar}
        </div>
      )}
      {frontend.mounted && (
        <div inert={frontend.preview !== null} className="contents">
          <FrontendLayer />
          {frontend.visible && (
            <OfflineBadge className="pointer-events-none fixed top-3 right-3 z-[110]" />
          )}
        </div>
      )}
      {frontend.preview && <MenuPreviewLayer draft={frontend.preview} onClose={frontend.hide} />}
    </div>
  );
}
