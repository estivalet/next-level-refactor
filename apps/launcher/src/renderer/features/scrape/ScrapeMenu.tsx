import type { BatchScope } from '@nextlevel/shared';
import { ChevronDown, ImageDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BatchProgress } from './BatchProgress.tsx';
import { useBatchStatus } from './batchApi.ts';

interface ScrapeMenuProps {
  /** The system shown in the list, offered as "Scrape <name>…". */
  system: { id: string; name: string } | null;
  /** The selected games; two or more are offered as "Scrape n selected games…". */
  selectedIds: readonly number[];
  /** Opens the batch rules for a scope (the dialog lives in the Library's overlays). */
  onRules: (scope: BatchScope) => void;
  /** Shows the Needs review filter (of the job's systems); without it the summary has no button. */
  onShowReview?: (systemIds: string[] | null) => void;
}

/** Scrape ▾ in the Library header (S7, FR-SCR-2, US-C6), next to Scan ▾, with the job's progress. */
export function ScrapeMenu({ system, selectedIds, onRules, onShowReview }: ScrapeMenuProps) {
  const { t } = useTranslation();
  const status = useBatchStatus();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const state = status.data?.state;
  const lastState = useRef(state);
  // Set when the rules dialog opens from here; a batch resuming on its own (quota) never takes focus.
  const armed = useRef(false);
  // Unknown until main answers: offer nothing rather than a batch main would refuse.
  const busy = state === undefined || state === 'running' || state === 'paused';

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => {
      document.removeEventListener('mousedown', outside);
    };
  }, [open]);

  // A batch just started from here (the rules dialog and Scrape ▾ are gone): Pause gets the keyboard.
  useEffect(() => {
    if (state === lastState.current) return;
    const started = state === 'running' && armed.current;
    lastState.current = state;
    armed.current = false;
    const active = document.activeElement;
    if (started && (active === null || active === document.body)) {
      root.current?.querySelector<HTMLElement>('button')?.focus();
    }
  }, [state]);

  const items = [
    ...(system
      ? [
          {
            key: 'system',
            label: t('library.batch.system', { system: system.name }),
            scope: { systemIds: [system.id] },
          },
        ]
      : []),
    ...(selectedIds.length > 1
      ? [
          {
            key: 'selected',
            label: t('library.batch.selected', { count: selectedIds.length }),
            scope: { gameIds: [...selectedIds] },
          },
        ]
      : []),
  ];

  return (
    <div ref={root} className="relative flex items-center gap-3">
      {status.data && (
        <BatchProgress status={status.data} {...(onShowReview ? { onShowReview } : {})} />
      )}
      {!busy && items.length > 0 && (
        <button
          ref={button}
          type="button"
          onFocus={() => {
            // Back here from the rules dialog without starting.
            armed.current = false;
          }}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
          className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <ImageDown aria-hidden="true" className="h-3.5 w-3.5" />
          {t('library.batch.button')}
          <ChevronDown aria-hidden="true" className="h-3 w-3" />
        </button>
      )}
      {open && (
        <div
          role="menu"
          aria-label={t('library.batch.menu')}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
          className="absolute top-full right-0 z-30 mt-1 min-w-56 rounded-lg border border-white/10 bg-[#1a1a24] py-1 text-sm text-slate-300 shadow-2xl"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                // The rules dialog gives the keyboard back to what had it: Scrape ▾, not this item.
                button.current?.focus();
                armed.current = true;
                setOpen(false);
                onRules(item.scope);
              }}
              className="flex w-full px-4 py-2 text-left hover:bg-white/10 hover:text-white focus:bg-white/10 focus:outline-none"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
