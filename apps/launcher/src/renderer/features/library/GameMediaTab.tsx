import { GAME_ART_KINDS, mediaUrl, type GameDetails } from '@nextlevel/shared';
import { ImageOff, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Every art kind of a game, found or not (look-only). The standard kinds always show so holes are
 * visible; any other kind the media index found for the game (`manual`, `box-side`…) follows.
 * What exists comes from the media index (FR-SCR-5), never from the disk.
 */
export function GameMediaTab({ game }: { game: GameDetails }) {
  const { t } = useTranslation();
  const [foundOnly, setFoundOnly] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const standard: readonly string[] = GAME_ART_KINDS;
  const extras = Object.keys(game.media)
    .filter((kind) => !standard.includes(kind))
    .sort();
  const kinds = [...standard, ...extras];
  const found = kinds.filter((kind) => game.media[kind] !== undefined);
  const shown = foundOnly ? found : kinds;
  const label = (kind: string) =>
    t(`settings.themes.options.kinds.${kind}`, { defaultValue: kind });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{t('library.edit.media.found', { found: found.length, total: kinds.length })}</span>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={foundOnly}
            onChange={(event) => {
              setFoundOnly(event.target.checked);
            }}
          />
          {t('library.edit.media.foundOnly')}
        </label>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {shown.map((kind) => {
          const version = game.media[kind];
          const src = version === undefined ? null : mediaUrl(game.id, kind, version);
          return (
            <li
              key={kind}
              className={`overflow-hidden rounded-lg border ${
                src ? 'border-emerald-500/30' : 'border-white/5 opacity-60'
              } bg-black/30`}
            >
              {src ? (
                <button
                  type="button"
                  aria-label={t('library.edit.media.view', { kind: label(kind) })}
                  onClick={() => {
                    setViewing(kind);
                  }}
                  className="flex aspect-[4/3] w-full items-center justify-center bg-black/40 hover:bg-black/20 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
                >
                  <MediaPreview kind={kind} src={src} label={label(kind)} />
                </button>
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 text-[10px] text-slate-600">
                  <ImageOff aria-hidden="true" className="h-5 w-5" />
                  {t('library.edit.media.notFound')}
                </div>
              )}
              <p className="flex items-center gap-1.5 truncate border-t border-white/5 px-2 py-1 text-[10px] text-slate-400">
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${src ? 'bg-emerald-400' : 'bg-slate-600'}`}
                />
                {label(kind)}
              </p>
            </li>
          );
        })}
      </ul>
      {viewing !== null && (
        <MediaViewer
          kind={viewing}
          label={label(viewing)}
          src={mediaUrl(game.id, viewing, game.media[viewing])}
          onClose={() => {
            setViewing(null);
          }}
        />
      )}
    </div>
  );
}

function MediaPreview({ kind, src, label }: { kind: string; src: string; label: string }) {
  return kind === 'video' ? (
    <video
      src={src}
      aria-label={label}
      className="h-full w-full object-cover"
      muted
      preload="metadata"
    />
  ) : (
    <img src={src} alt={label} className="h-full w-full object-contain" loading="lazy" />
  );
}

/** One art file full size over the Library; Esc or the close button returns to the tiles. */
function MediaViewer(props: { kind: string; label: string; src: string; onClose: () => void }) {
  const { kind, label, src, onClose } = props;
  const { t } = useTranslation();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
  }, []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
      onClick={onClose}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-black/85 p-6"
    >
      <button
        ref={close}
        type="button"
        aria-label={t('library.close')}
        onClick={onClose}
        className="absolute top-3 right-3 rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
      >
        <X aria-hidden="true" className="h-5 w-5" />
      </button>
      {kind === 'video' ? (
        <video
          src={src}
          aria-label={label}
          className="max-h-[85%] max-w-full"
          controls
          autoPlay
          onClick={(event) => {
            event.stopPropagation();
          }}
        />
      ) : (
        <img src={src} alt={label} className="max-h-[85%] max-w-full object-contain" />
      )}
      <p className="text-xs text-slate-300">{label}</p>
    </div>
  );
}
