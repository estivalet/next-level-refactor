import type { Settings, SystemDefinition } from '@nextlevel/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

const ROW_HEIGHT = 56;

/** Virtualized system rows: name, maker, effective folder, enable switch and Edit (FR-EMU-1). */
export function SystemList({
  systems,
  settings,
  onToggle,
  onEdit,
}: {
  systems: readonly SystemDefinition[];
  settings: Settings['systems'];
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
}) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns functions that can't be auto-memoized; nothing here relies on the
  // React Compiler, so its "incompatible library" notice doesn't apply.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: systems.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    // First paint (and jsdom) before the scroller is measured.
    initialRect: { width: 640, height: 480 },
  });

  if (systems.length === 0) {
    return <p className="text-sm text-slate-400">{t('settings.systems.noResults')}</p>;
  }

  return (
    <div ref={scroller} className="h-[420px] overflow-y-auto rounded-lg border border-white/10">
      <ul
        aria-label={t('settings.systems.list')}
        className="relative"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const system = systems[item.index];
          if (!system) return null;
          const enabled = settings[system.id]?.enabled === true;
          const folder = settings[system.id]?.folderName ?? system.defaultFolderName;
          return (
            <li
              key={system.id}
              data-system-id={system.id}
              className="absolute inset-x-0 flex items-center gap-3 border-b border-white/5 px-3"
              style={{ top: item.start, height: ROW_HEIGHT }}
            >
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={t('settings.systems.enable', { name: system.name })}
                onClick={() => {
                  onToggle(system.id, !enabled);
                }}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none ${
                  enabled ? 'bg-[#990033]' : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-white">{system.name}</span>
                <span className="truncate text-xs text-slate-400">
                  {[system.manufacturer, t('settings.systems.folder', { folder })]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              <button
                type="button"
                aria-label={t('settings.systems.edit', { name: system.name })}
                onClick={() => {
                  onEdit(system.id);
                }}
                className="rounded-lg px-2 py-1 text-xs text-slate-200 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                {t('settings.systems.editShort')}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
