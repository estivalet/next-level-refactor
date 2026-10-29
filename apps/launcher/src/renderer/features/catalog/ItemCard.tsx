import type { CatalogListItem, DownloadSummary } from '@nextlevel/shared';
import { Gamepad2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatBytes, stateText } from './catalogText.ts';

/** One catalog item in a row or the results (S8): art, title, system, size, license and state. */
export function ItemCard({
  item,
  systemName,
  download,
  onOpen,
}: {
  item: CatalogListItem;
  systemName: string;
  download: DownloadSummary | undefined;
  onOpen: (itemId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const state = stateText(t, item, download);
  const busy = item.installState === 'downloading' || item.installState === 'queued';
  const tone =
    item.installState === 'failed'
      ? 'text-[#ff8a80]'
      : item.installState === 'update' || busy
        ? 'text-amber-200'
        : item.installState === 'none'
          ? 'text-slate-400'
          : 'text-emerald-300';
  return (
    <button
      type="button"
      data-card
      data-item-id={item.id}
      onClick={() => {
        onOpen(item.id);
      }}
      className="flex w-40 shrink-0 flex-col gap-1 rounded-lg border border-white/10 bg-black/30 p-2 text-left hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
    >
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded bg-white/5">
        {item.boxArt ? (
          <img src={item.boxArt} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <Gamepad2 aria-hidden="true" className="h-8 w-8 text-slate-600" />
        )}
      </div>
      <span className="truncate text-sm font-medium text-white">{item.title}</span>
      <span className="truncate text-xs text-slate-400">{systemName}</span>
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <span>{formatBytes(item.size, i18n.language)}</span>
        <span aria-hidden="true">·</span>
        <span className="rounded bg-white/10 px-1 text-[10px] text-slate-200">
          {t(`catalog.license.${item.license.type}`)}
        </span>
      </span>
      <span className={`text-xs ${tone}`}>{state}</span>
    </button>
  );
}
