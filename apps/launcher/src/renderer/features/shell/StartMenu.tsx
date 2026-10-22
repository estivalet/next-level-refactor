import { MonitorPlay, Power, Search } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { apps, type AppId } from '../../apps/registry.ts';
import { useFrontend } from '../frontend/useFrontend.ts';
import { useQuitApp } from './api.ts';
import { filterApps } from './filterApps.ts';
import { useOpenApp } from './useOpenApp.ts';

const ROW =
  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/10 focus-visible:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none';

/** The Start panel: app search, the app list and Quit. Esc or a click outside closes it. */
export function StartMenu({
  onClose,
  startButton,
}: {
  onClose: () => void;
  startButton: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const openApp = useOpenApp();
  const quit = useQuitApp();
  const frontend = useFrontend();
  const [query, setQuery] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const matches = filterApps(apps, query, t);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panel.current?.contains(target) || startButton.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose, startButton]);

  function choose(id: AppId) {
    openApp(id);
    onClose();
  }

  return (
    <motion.div
      ref={panel}
      role="dialog"
      aria-label={t('shell.start.menu')}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
          startButton.current?.focus();
        }
      }}
      className="absolute bottom-20 left-1/2 z-[9999] flex h-[420px] w-[480px] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1a1c23]/95 shadow-2xl backdrop-blur-2xl"
    >
      <div className="relative border-b border-white/5 bg-white/5 p-4">
        <Search
          aria-hidden="true"
          className="absolute top-1/2 left-7 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          autoFocus
          aria-label={t('shell.start.search')}
          placeholder={t('shell.start.search')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          className="w-full rounded-full border border-white/10 bg-black/20 py-1.5 pr-4 pl-9 text-xs text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
        />
      </div>
      <div className="border-b border-white/5 p-2">
        <button
          type="button"
          className={ROW}
          onClick={() => {
            frontend.show();
            onClose();
          }}
        >
          <MonitorPlay aria-hidden="true" className="h-4 w-4 text-[#ff4d7a]" />
          {t('frontend.open')}
        </button>
      </div>
      <ul aria-label={t('shell.start.apps')} className="flex-1 overflow-y-auto p-2">
        {matches.map((app) => (
          <li key={app.id}>
            <button
              type="button"
              className={ROW}
              onClick={() => {
                choose(app.id);
              }}
            >
              <app.icon aria-hidden="true" className="h-4 w-4" />
              {t(app.titleKey)}
            </button>
          </li>
        ))}
        {matches.length === 0 && (
          <li className="px-3 py-2 text-xs text-slate-500">{t('shell.start.noResults')}</li>
        )}
      </ul>
      <div className="border-t border-white/5 p-2">
        <button type="button" className={ROW} onClick={quit}>
          <Power aria-hidden="true" className="h-4 w-4 text-[#ff5f56]" />
          {t('shell.start.quit')}
        </button>
      </div>
    </motion.div>
  );
}
