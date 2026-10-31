import { mediaUrl, type GameDetails } from '@nextlevel/shared';
import { Gamepad2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** What the details show first (D62): the video, then a gameplay screenshot, then the box. */
const PREVIEW_KINDS = ['video', 'screenshot-game-play', 'box-front'] as const;

/**
 * The game's preview from the media index (FR-SCR-5, D62); the URL carries the file version, so
 * re-scraped media shows at once. A placeholder when there is none or it fails to load.
 */
export function DetailsArt({ game }: { game: GameDetails }) {
  const kind = PREVIEW_KINDS.find((k) => game.media[k] !== undefined);
  const src = kind === undefined ? null : mediaUrl(game.id, kind, game.media[kind]);
  const [broken, setBroken] = useState<string | null>(null);
  return (
    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-emerald-900/30 to-slate-900">
      {src && broken !== src && kind === 'video' ? (
        <video
          src={src}
          aria-label={game.title}
          className="h-full w-full object-cover"
          muted
          loop
          autoPlay
          playsInline
          onError={() => {
            setBroken(src);
          }}
        />
      ) : src && broken !== src ? (
        <img
          src={src}
          alt={game.title}
          className="h-full w-full object-contain"
          onError={() => {
            setBroken(src);
          }}
        />
      ) : (
        <Gamepad2 aria-hidden="true" className="h-12 w-12 text-emerald-400/20" />
      )}
    </div>
  );
}

/** "Scraped <date>", "Needs review", … (S7); nothing for a game never scraped. */
export function ScrapeStatusLine({ game }: { game: GameDetails }) {
  const { t, i18n } = useTranslation();
  if (!game.scrape) return null;
  const { status, scrapedAt } = game.scrape;
  const date = new Date(scrapedAt).toLocaleDateString(i18n.language);
  return (
    <p className={`text-xs ${status === 'scraped' ? 'text-slate-500' : 'text-amber-300'}`}>
      {t(`library.scrape.status.${status}`, { date })}
    </p>
  );
}
