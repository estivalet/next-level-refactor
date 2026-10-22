// Ported from NextLevelOS src/themes/components/GameDetailPanel.tsx @ 3d530b7: games are ThemeGames,
// and the description is loaded from the host once the focus has settled (FR-THM-6).
import type { ThemeGame } from '@nextlevel/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeHost } from '../engine/useThemeNavigation.ts';
import { cn } from './cn.ts';
import { useSettledFocus } from './useSettledFocus.ts';

/** Scraped descriptions may carry HTML line breaks and tags; show plain text. */
export function plainDescription(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/** "1983 · Developer · Genre", leaving out what is unknown. */
export function gameMeta(game: ThemeGame): string {
  return [game.year === null ? null : String(game.year), game.developer, game.genre]
    .filter(Boolean)
    .join(' · ');
}

/** The description of `game`, loaded once it stayed focused for `settleMs`; null meanwhile. */
export function useGameDescription(game: ThemeGame | null, settleMs = 250): string | null {
  const host = useThemeHost();
  const settledId = useSettledFocus(game?.id ?? null, settleMs);
  const [loaded, setLoaded] = useState<{ id: number; text: string | null } | null>(null);
  useEffect(() => {
    if (settledId === null) return;
    let alive = true;
    host.getGameDetails(settledId).then(
      (details) => {
        if (alive) setLoaded({ id: settledId, text: details.description });
      },
      () => {
        if (alive) setLoaded({ id: settledId, text: null });
      },
    );
    return () => {
      alive = false;
    };
  }, [host, settledId]);
  return loaded && loaded.id === game?.id && loaded.text ? plainDescription(loaded.text) : null;
}

export function GameDetailPanel({
  game,
  onLaunch,
  slots,
  className,
  settleMs = 250,
}: {
  game: ThemeGame | null;
  onLaunch: (game: ThemeGame) => void;
  slots?: {
    renderTitle?: (game: ThemeGame) => ReactNode;
    renderMeta?: (game: ThemeGame) => ReactNode;
    renderActions?: (game: ThemeGame, launch: () => void) => ReactNode;
  };
  className?: string;
  settleMs?: number;
}) {
  const { t } = useTranslation();
  const description = useGameDescription(game, settleMs);
  if (!game) return null;
  const launch = () => {
    onLaunch(game);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {slots?.renderTitle ? (
        slots.renderTitle(game)
      ) : (
        <h1 className="text-3xl leading-tight font-black text-white">{game.title}</h1>
      )}
      {slots?.renderMeta ? (
        slots.renderMeta(game)
      ) : (
        <div className="text-sm text-white/70">{gameMeta(game)}</div>
      )}
      <p className="line-clamp-5 min-h-[1lh] max-w-2xl text-sm leading-relaxed whitespace-pre-line text-white/80">
        {description}
      </p>
      {slots?.renderActions ? (
        slots.renderActions(game, launch)
      ) : (
        <button
          type="button"
          tabIndex={-1}
          onClick={launch}
          className="w-fit rounded-md bg-rose-600 px-6 py-2 text-sm font-bold text-white hover:bg-rose-500"
        >
          ▶ {t('themes.common.play')}
        </button>
      )}
    </div>
  );
}
