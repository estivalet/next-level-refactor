import { ArrowLeft } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSystemCatalog } from '../settings/settingsApi.ts';
import {
  useCatalogItem,
  useDownloadAction,
  useDownloads,
  useInstall,
  useInstalled,
} from './catalogApi.ts';
import { actionErrorKey, formatBytes, isOffline, stateText } from './catalogText.ts';
import { useUninstallFlow } from './UninstallDialog.tsx';
import { pressFocused, useCatalogInput } from './useCatalogInput.ts';

const BUTTON =
  'rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50';

/**
 * A catalog item (S8, US-E1): art, screenshots, description, the license credit, size, and
 * Install / Update / Play / Uninstall by where it stands on this PC.
 */
export function ItemDetail({
  itemId,
  onBack,
  onPlay,
}: {
  itemId: string;
  onBack: () => void;
  onPlay: (gameId: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const query = useCatalogItem(itemId);
  const install = useInstall();
  const flow = useUninstallFlow();
  const installedGame = useInstalled().data?.find((row) => row.itemId === itemId);
  const act = useDownloadAction();
  const active = useDownloads().data?.find(
    (row) => row.itemId === itemId && row.state !== 'failed',
  );
  const systems = useSystemCatalog().data ?? [];
  const box = useRef<HTMLElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  // Keyboard and gamepad (D47): back closes, arrows walk the buttons, select presses one.
  const keys = useCatalogInput(box, (action) => {
    if (action === 'back') onBack();
    else if (action === 'select') pressFocused();
    else if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      const buttons = [
        ...(box.current?.querySelectorAll<HTMLButtonElement>('button') ?? []),
      ].filter((button) => !button.disabled);
      const at = buttons.findIndex((button) => button === document.activeElement);
      const step = action === 'left' || action === 'up' ? -1 : 1;
      buttons[Math.max(0, Math.min(at + step, buttons.length - 1))]?.focus();
    }
  });
  useEffect(() => {
    backButton.current?.focus();
  }, []);
  const back = (
    <button
      ref={backButton}
      type="button"
      onClick={onBack}
      className="flex w-fit items-center gap-1 text-sm text-sky-300 hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      {t('catalog.back')}
    </button>
  );
  if (!query.data) {
    return (
      <section ref={box} {...keys} className="flex flex-col gap-3 p-4">
        {back}
        {query.error && (
          <p role="alert" className="text-sm text-slate-300">
            {t(isOffline(query.error) ? 'catalog.offline' : 'catalog.loadFailed')}
          </p>
        )}
      </section>
    );
  }
  const item = query.data;
  const state = item.installState;
  const canInstall = state === 'none' || state === 'failed';
  const canPlay = installedGame !== undefined;
  const screenshots = item.media.filter((media) => media.kind.startsWith('screenshot'));
  const actionError = install.error ?? act.error ?? flow.error;

  return (
    <section
      ref={box}
      {...keys}
      aria-labelledby={titleId}
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
    >
      {back}
      <div className="flex gap-4">
        {item.boxArt && (
          <img src={item.boxArt} alt={item.title} className="h-48 w-36 rounded object-cover" />
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <h2 id={titleId} className="text-lg font-semibold text-white">
            {item.title}
          </h2>
          <p className="text-sm text-slate-400">
            {[
              systems.find((s) => s.id === item.systemId)?.name ?? item.systemId,
              item.year,
              item.developer,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="text-xs text-slate-300">
            {t('catalog.credit', {
              type: t(`catalog.license.${item.license.type}`),
              holder: item.license.rightsHolder,
            })}
          </p>
          <p className="text-xs text-slate-400">{formatBytes(item.size, i18n.language)}</p>
          {state === 'gone' && <p className="text-xs text-amber-200">{t('catalog.state.gone')}</p>}
          {active && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-amber-200">{stateText(t, item, active)}</p>
              <progress
                aria-label={t('catalog.downloads.progress', { title: item.title })}
                value={active.bytesDone}
                max={Math.max(active.bytesTotal, 1)}
                className="h-1.5 w-48"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {canInstall && (
              <button
                type="button"
                disabled={install.isPending}
                onClick={() => {
                  install.mutate(item.id);
                }}
                className={`${BUTTON} bg-emerald-600 text-white hover:bg-emerald-500`}
              >
                {t('catalog.actions.install')}
              </button>
            )}
            {state === 'update' && (
              <button
                type="button"
                disabled={install.isPending}
                onClick={() => {
                  install.mutate(item.id);
                }}
                className={`${BUTTON} bg-amber-600 text-white hover:bg-amber-500`}
              >
                {t('catalog.actions.update')}
              </button>
            )}
            {active && (
              <button
                type="button"
                disabled={act.isPending}
                onClick={() => {
                  act.mutate({
                    downloadId: active.id,
                    action: active.state === 'paused' ? 'resume' : 'pause',
                  });
                }}
                className={`${BUTTON} bg-white/10 text-white hover:bg-white/20`}
              >
                {t(
                  active.state === 'paused'
                    ? 'catalog.downloads.resume'
                    : 'catalog.downloads.pause',
                )}
              </button>
            )}
            {canPlay && (
              <button
                type="button"
                onClick={() => {
                  onPlay(installedGame.gameId);
                }}
                className={`${BUTTON} bg-sky-600 text-white hover:bg-sky-500`}
              >
                {t('catalog.actions.play')}
              </button>
            )}
            {canPlay && (
              <button
                type="button"
                disabled={flow.pending}
                onClick={() => {
                  flow.start(item.id, item.title);
                }}
                className={`${BUTTON} bg-white/10 text-white hover:bg-white/20`}
              >
                {t('catalog.actions.uninstall')}
              </button>
            )}
          </div>
          {actionError && (
            <p role="alert" className="text-xs text-[#ff8a80]">
              {t(actionErrorKey(actionError))}
            </p>
          )}
        </div>
      </div>
      {item.description && (
        <p className="text-sm whitespace-pre-line text-slate-200">{item.description}</p>
      )}
      {screenshots.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {screenshots.map((media) => (
            <img
              key={media.kind}
              src={media.url}
              alt={t('catalog.screenshot')}
              className="h-32 rounded object-cover"
            />
          ))}
        </div>
      )}
      {flow.dialog}
    </section>
  );
}
