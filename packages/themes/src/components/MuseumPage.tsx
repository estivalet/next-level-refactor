// The system museum page (FR-MUS-4, FR-MUS-5): a controller-driven overlay a theme opens for a
// system. Up/down move among the owned top games and scroll; select launches one.
import type { InputAction, InputSettings } from '@nextlevel/shared';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useInputActions } from '../input/useInputActions.ts';
import { cn } from './cn.ts';
import { LevelLogo } from './LevelLogo.tsx';
import './museum.css';
import { Hardware, headline, isEmptyEntry, Models, Sources, TopGames } from './museumSections.tsx';
import { useThemeSystemInfo } from './useSystemInfo.ts';

const SCROLL_STEP = 240;

export function MuseumPage({
  open,
  enabled = true,
  systemId,
  title,
  logoCandidates,
  input,
  onClose,
  onLaunch,
  className,
}: {
  open: boolean;
  /** False while the theme behind it takes no input. */
  enabled?: boolean;
  systemId: string | null;
  /** The node's label: shown while loading and when the entry is empty. */
  title: string;
  logoCandidates: string[];
  input: InputSettings;
  onClose: () => void;
  onLaunch: (gameId: number) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  // Null while loading (and for an unknown system, which the host cannot tell apart).
  const info = useThemeSystemInfo(open ? systemId : null, 0);

  useEffect(() => {
    if (open && enabled) panelRef.current?.focus();
  }, [open, enabled]);

  const move = (delta: 1 | -1) => {
    const panel = panelRef.current;
    if (!panel) return;
    const stops = Array.from(panel.querySelectorAll<HTMLElement>('[data-museum-focus]'));
    const at = stops.indexOf(document.activeElement as HTMLElement);
    const next = at + delta;
    const target = next >= 0 && next < stops.length ? stops[next] : undefined;
    if (target) {
      target.focus();
      // jsdom has no layout, so scrollIntoView does not exist there.
      if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest' });
    } else if (delta < 0 && at >= 0) {
      panel.focus();
      panel.scrollTop = 0;
    } else if (typeof panel.scrollBy === 'function') {
      panel.scrollBy({ top: delta * SCROLL_STEP });
    }
  };

  useInputActions({
    targetRef: panelRef,
    enabled: open && enabled,
    input,
    onAction: (action: InputAction) => {
      if (action === 'back' || action === 'menu') onClose();
      else if (action === 'down') move(1);
      else if (action === 'up') move(-1);
      else if (action === 'select') {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.hasAttribute('data-museum-focus')) {
          active.click();
        }
      }
    },
  });
  if (!open) return null;

  const meta = info ? headline(info) : '';
  const empty = info ? isEmptyEntry(info) : false;
  return (
    <div className={cn('museum-backdrop', className)} onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label={title}
        className="museum-panel"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="museum-header">
          <LevelLogo candidates={logoCandidates} fallbackText={title} className="museum-logo" />
          {meta && <p className="museum-meta">{meta}</p>}
        </header>
        {!info && <p className="museum-note">{t('themes.museum.loading')}</p>}
        {info && empty && <p className="museum-note">{t('themes.museum.empty')}</p>}
        {info && !empty && (
          <>
            {info.description && <p className="museum-description">{info.description}</p>}
            <Hardware info={info} />
            <Models info={info} />
            <TopGames info={info} onLaunch={onLaunch} />
            <Sources info={info} />
          </>
        )}
      </div>
    </div>
  );
}
