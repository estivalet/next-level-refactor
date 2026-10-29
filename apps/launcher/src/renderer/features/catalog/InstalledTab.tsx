import { useTranslation } from 'react-i18next';
import { useSystemCatalog } from '../settings/settingsApi.ts';
import { useInstall, useInstalled } from './catalogApi.ts';
import { useUninstallFlow } from './UninstallDialog.tsx';

const BUTTON =
  'rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50';

/** Catalog → Installed (FR-CAT-5, FR-CAT-7): this PC's catalog games; works offline. */
export function InstalledTab({ onPlay }: { onPlay: (gameId: number) => void }) {
  const { t } = useTranslation();
  const installed = useInstalled();
  const install = useInstall();
  const flow = useUninstallFlow();
  const systems = useSystemCatalog().data ?? [];
  const rows = installed.data ?? [];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      {installed.isSuccess && rows.length === 0 && (
        <p className="text-sm text-slate-400">{t('catalog.installed.empty')}</p>
      )}
      <ul aria-label={t('catalog.installed.title')} className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.itemId}
            className="flex items-center gap-3 rounded-lg border border-white/10 p-3"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm text-white">{row.title}</span>
              <span className="text-xs text-slate-400">
                {systems.find((s) => s.id === row.systemId)?.name ?? row.systemId} ·{' '}
                {t('catalog.installed.version', { version: row.version })}
              </span>
              {row.state !== 'current' && (
                <span className="text-xs text-amber-200">{t(`catalog.state.${row.state}`)}</span>
              )}
            </div>
            <button
              type="button"
              className={BUTTON}
              onClick={() => {
                onPlay(row.gameId);
              }}
            >
              {t('catalog.actions.play')}
            </button>
            {row.state === 'update' && (
              <button
                type="button"
                className={BUTTON}
                disabled={install.isPending}
                onClick={() => {
                  install.mutate(row.itemId);
                }}
              >
                {t('catalog.actions.update')}
              </button>
            )}
            <button
              type="button"
              className={BUTTON}
              disabled={flow.pending}
              onClick={() => {
                flow.start(row.itemId, row.title);
              }}
            >
              {t('catalog.actions.uninstall')}
            </button>
          </li>
        ))}
      </ul>
      {flow.error && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {t('catalog.actionFailed')}
        </p>
      )}
      {flow.dialog}
    </div>
  );
}
