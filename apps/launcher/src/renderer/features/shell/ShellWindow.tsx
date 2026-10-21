import { Minus, Square, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useShell } from './ShellContext.tsx';
import { useWindowPointer } from './useWindowPointer.ts';
import type { ShellWindow as ShellWindowState } from './windowManager.ts';

const LIGHT =
  'group/light flex h-3 w-3 items-center justify-center rounded-full transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none';

export function ShellWindow({
  win,
  title,
  children,
}: {
  win: ShellWindowState;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { state, dispatch } = useShell();
  const reduceMotion = useReducedMotion();
  const drag = useWindowPointer('drag', win);
  const resize = useWindowPointer('resize', win);
  const focused = state.focusedId === win.id;
  const placement = win.maximized
    ? { inset: 0 }
    : { left: win.rect.x, top: win.rect.y, width: win.rect.width, height: win.rect.height };

  return (
    <motion.div
      role="dialog"
      aria-label={title}
      hidden={win.minimized}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      onPointerDown={() => {
        dispatch({ type: 'focus', id: win.id });
      }}
      style={{ ...placement, zIndex: win.z }}
      className={`absolute flex flex-col overflow-hidden border bg-[#1a1c23]/95 shadow-2xl backdrop-blur-xl ${
        win.maximized ? 'rounded-none' : 'rounded-xl'
      } ${focused ? 'border-white/20' : 'border-white/5'}`}
    >
      <div
        {...drag}
        className="flex h-9 shrink-0 cursor-default items-center justify-between border-b border-white/5 bg-white/5 px-3 select-none"
      >
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={t('shell.window.close')}
            onClick={() => {
              dispatch({ type: 'close', id: win.id });
            }}
            className={`${LIGHT} bg-[#ff5f56]`}
          >
            <X className="h-2 w-2 text-black/50 opacity-0 group-hover/light:opacity-100" />
          </button>
          <button
            type="button"
            aria-label={t('shell.window.minimize')}
            onClick={() => {
              dispatch({ type: 'toggleMinimize', id: win.id });
            }}
            className={`${LIGHT} bg-[#ffbd2e]`}
          >
            <Minus className="h-2 w-2 text-black/50 opacity-0 group-hover/light:opacity-100" />
          </button>
          <button
            type="button"
            aria-label={t(win.maximized ? 'shell.window.restore' : 'shell.window.maximize')}
            onClick={() => {
              dispatch({ type: 'toggleMaximize', id: win.id });
            }}
            className={`${LIGHT} bg-[#27c93f]`}
          >
            <Square className="h-2 w-2 text-black/50 opacity-0 group-hover/light:opacity-100" />
          </button>
        </div>
        <span className="text-xs font-medium tracking-wide text-slate-400">{title}</span>
        <span className="w-12" />
      </div>
      <div className="relative flex-1 overflow-auto bg-black/20 text-slate-200">{children}</div>
      {!win.maximized && (
        <div
          {...resize}
          aria-hidden="true"
          className="absolute right-0 bottom-0 flex h-5 w-5 cursor-nwse-resize items-end justify-end p-1"
        >
          <div className="h-2 w-2 border-r-2 border-b-2 border-white/40" />
        </div>
      )}
    </motion.div>
  );
}
