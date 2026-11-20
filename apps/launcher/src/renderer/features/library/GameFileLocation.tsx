import type { GameDetails } from '@nextlevel/shared';
import { Check, Copy, FolderOpen } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRevealGame } from './libraryApi.ts';

const ACTION =
  'flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white';

/** How long "Copied" shows after Copy path. */
const COPIED_MS = 2000;

/**
 * Where a game's file is (FR-LIB-16, US-C9): the full path, selectable, with Copy path and Open
 * folder. For a missing game the path is where it was expected, and Open folder shows the
 * nearest folder that still exists. Nothing on disk changes.
 */
export function GameFileLocation({ game }: { game: GameDetails }) {
  const { t } = useTranslation();
  const labelId = useId();
  const reveal = useRevealGame();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => {
      setCopied(false);
    }, COPIED_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);
  // A new game starts without "Copied".
  const [shownFor, setShownFor] = useState(game.id);
  if (shownFor !== game.id) {
    setShownFor(game.id);
    setCopied(false);
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5 text-xs">
      <span id={labelId} className="text-[11px] text-slate-500">
        {t(game.missing ? 'library.details.expectedFile' : 'library.details.file')}
      </span>
      <p className="font-mono text-[11px] break-all text-slate-300 select-text">{game.filePath}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={ACTION}
          onClick={() => {
            // Clipboard denied: nothing to undo, the path stays selectable.
            navigator.clipboard.writeText(game.filePath).then(
              () => {
                setCopied(true);
              },
              () => undefined,
            );
          }}
        >
          {copied ? (
            <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {t(copied ? 'library.details.pathCopied' : 'library.details.copyPath')}
        </button>
        <button
          type="button"
          className={ACTION}
          onClick={() => {
            reveal.mutate(game.id);
          }}
        >
          <FolderOpen aria-hidden="true" className="h-3.5 w-3.5" />
          {t('library.details.openFolder')}
        </button>
      </div>
    </div>
  );
}
