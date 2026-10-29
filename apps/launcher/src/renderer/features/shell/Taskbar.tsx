import { Grid, MonitorPlay } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApp } from '../../apps/registry.ts';
import { useFrontend } from '../frontend/useFrontend.ts';
import { useShell } from './ShellContext.tsx';
import { StartMenu } from './StartMenu.tsx';
import { OfflineBadge } from '../auth/OfflineBadge.tsx';
import { TrayClock } from './TrayClock.tsx';
import { CatalogRemovedNotice } from './CatalogRemovedNotice.tsx';
import { TrayDownloads } from './TrayDownloads.tsx';
import type { ShellWindow } from './windowManager.ts';

const FOCUS_RING = 'focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';

/** Floating dock: Start, one entry per open window, and the tray (FR-SHELL-4). */
export function Taskbar() {
  const { t } = useTranslation();
  const { state, dispatch } = useShell();
  const frontend = useFrontend();
  const [startOpen, setStartOpen] = useState(false);
  const startButton = useRef<HTMLButtonElement>(null);
  const closeStart = useCallback(() => {
    setStartOpen(false);
  }, []);

  function activate(win: ShellWindow) {
    const isFront = state.focusedId === win.id && !win.minimized;
    dispatch(isFront ? { type: 'toggleMinimize', id: win.id } : { type: 'focus', id: win.id });
  }

  return (
    <nav
      aria-label={t('shell.taskbar.label')}
      className="relative z-10 mx-auto mb-3 flex items-center gap-2 rounded-3xl border border-white/10 bg-black/40 px-3 py-2 shadow-2xl backdrop-blur-2xl"
    >
      {startOpen && <StartMenu onClose={closeStart} startButton={startButton} />}
      <button
        ref={startButton}
        type="button"
        aria-label={t('shell.start.button')}
        aria-haspopup="dialog"
        aria-expanded={startOpen}
        onClick={() => {
          setStartOpen((open) => !open);
        }}
        className={`flex h-12 w-12 items-center justify-center rounded-[20px] bg-[#990033] text-white shadow-lg transition-transform hover:scale-105 active:scale-95 ${FOCUS_RING}`}
      >
        <Grid aria-hidden="true" className="h-6 w-6" />
      </button>
      <button
        type="button"
        aria-label={t('frontend.open')}
        title={t('frontend.open')}
        onClick={() => {
          frontend.show();
        }}
        className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white hover:bg-white/10 ${FOCUS_RING}`}
      >
        <MonitorPlay aria-hidden="true" className="h-6 w-6" />
      </button>
      {state.windows.length > 0 && <div className="mx-1 h-8 w-px bg-white/10" />}
      <ul aria-label={t('shell.taskbar.openWindows')} className="flex items-center gap-2">
        {state.windows.map((win) => {
          const app = getApp(win.appId);
          if (!app) return null;
          const focused = state.focusedId === win.id && !win.minimized;
          return (
            <li key={win.id}>
              <button
                type="button"
                aria-label={t(app.titleKey)}
                aria-pressed={focused}
                onClick={() => {
                  activate(win);
                }}
                className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ${
                  focused ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'
                } ${FOCUS_RING}`}
              >
                <app.icon aria-hidden="true" className="h-6 w-6 text-white" />
                {focused && (
                  <span className="absolute -bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_8px_white]" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mx-1 h-8 w-px bg-white/10" />
      <div className="flex items-center gap-2 px-2">
        <OfflineBadge />
        <TrayDownloads />
        <CatalogRemovedNotice />
        <TrayClock />
      </div>
    </nav>
  );
}
