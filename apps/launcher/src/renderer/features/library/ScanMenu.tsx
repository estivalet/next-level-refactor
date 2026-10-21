import { ChevronDown, Loader2, ScanSearch } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessageKey } from '../settings/settingsApi.ts';
import { useCancelScan, useScanStatus, useStartScan } from './scanApi.ts';
import { summaryLine } from './scanSummary.ts';

interface ScanMenuProps {
  /** The system shown in the list, offered as "Scan <name>". */
  system: { id: string; name: string } | null;
}

/** Scan ▾ in the Library header (S7, FR-LIB-3): same channels and events as Settings → Storage. */
export function ScanMenu({ system }: ScanMenuProps) {
  const { t } = useTranslation();
  const status = useScanStatus();
  const start = useStartScan();
  const cancel = useCancelScan();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const progress = status.data?.running ? status.data.progress : null;
  const running = status.data?.running ?? false;
  const last = status.data?.last ?? null;

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

  const items = running
    ? [
        {
          key: 'cancel',
          label: t('library.scan.cancel'),
          run: () => {
            cancel.mutate();
          },
        },
      ]
    : [
        {
          key: 'all',
          label: t('library.scan.all'),
          run: () => {
            start.mutate(undefined);
          },
        },
        ...(system
          ? [
              {
                key: 'system',
                label: t('library.scan.system', { system: system.name }),
                run: () => {
                  start.mutate([system.id]);
                },
              },
            ]
          : []),
      ];
  const label = running
    ? t('library.scan.progress', {
        done: progress?.systemsDone ?? 0,
        total: progress?.systemsTotal ?? 0,
      })
    : t('library.scan.button');

  return (
    <div ref={root} className="relative flex items-center gap-3">
      {start.isError ? (
        <p role="alert" className="max-w-xs truncate text-[11px] text-red-300">
          {t(errorMessageKey(start.error))}
        </p>
      ) : (
        last &&
        !running && (
          <p role="status" className="max-w-xs truncate text-[11px] text-slate-500">
            {summaryLine(t, last)}
          </p>
        )
      )}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
        className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
      >
        {running ? (
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-emerald-400" />
        ) : (
          <ScanSearch aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {label}
        <ChevronDown aria-hidden="true" className="h-3 w-3" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t('library.scan.menu')}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
          className="absolute top-full right-0 z-30 mt-1 min-w-48 rounded-lg border border-white/10 bg-[#1a1a24] py-1 text-sm text-slate-300 shadow-2xl"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                item.run();
                setOpen(false);
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
