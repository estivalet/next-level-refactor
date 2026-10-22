// Showcase's info block for the focused game (ported from NextLevelOS showcase/GamesView.tsx
// @ 3d530b7): system logo, filter, last played, title, meta lines and badges, via i18n.
import type { ThemeGame } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { ClockIcon, EyeOffIcon, StarIcon } from '../components/icons.tsx';
import { LevelLogo } from '../components/LevelLogo.tsx';
import { isFavorite, isHidden } from '../engine/gameFlags.ts';
import { lastPlayed, lastPlayedLabel } from './lastPlayed.ts';

const join = (parts: Array<string | null | undefined>) => parts.filter(Boolean).join(' • ');

export function GameInfo({
  game,
  systemName,
  systemLogo,
  filterLabel,
}: {
  game: ThemeGame;
  systemName: string;
  systemLogo: string[];
  filterLabel?: string | undefined;
}) {
  const { t, i18n } = useTranslation();
  const played = lastPlayedLabel(lastPlayed(game.lastPlayedAt), t, i18n.language);
  const players = game.players
    ? /^\d+$/.test(game.players)
      ? t('themes.showcase.players', { count: Number(game.players) })
      : t('themes.showcase.playersRange', { players: game.players })
    : null;
  const line1 = join([game.year === null ? null : String(game.year), game.developer]);
  const line2 = join([game.genre, players]);
  return (
    <section className="sc-info">
      <LevelLogo candidates={systemLogo} fallbackText={systemName} className="sc-system-logo" />
      {filterLabel && <div className="sc-system-filter">{filterLabel}</div>}
      {played && (
        <div className="sc-played">
          <ClockIcon size={22} />
          {played}
        </div>
      )}
      <h1 className="sc-title">{game.title}</h1>
      {line1 && <div className="sc-meta">{line1}</div>}
      {line2 && <div className="sc-meta">{line2}</div>}
      <div className="sc-badges">
        {isFavorite(game) && (
          <span className="sc-badge" role="img" aria-label={t('themes.tabs.favorites')}>
            <StarIcon size={14} />
          </span>
        )}
        {isHidden(game) && (
          <span className="sc-badge" role="img" aria-label={t('themes.tabs.hidden')}>
            <EyeOffIcon size={14} />
          </span>
        )}
      </div>
    </section>
  );
}
