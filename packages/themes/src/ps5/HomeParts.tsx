// FR-THM-1: the PS5 home's selected-system title, hero meta line and bottom-right stats.
import type { ThemeSystemInfo } from '@nextlevel/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TrophyIcon } from '../components/icons.tsx';
import type { GameCountState } from '../components/useGameCount.ts';

/** The short-name badge and full name beside the focused shelf tile. */
export function ShelfTitle({ shortName, name }: { shortName?: string | undefined; name: string }) {
  return (
    <div className="ps5-title">
      {shortName && <span className="ps5-title-badge">{shortName.toUpperCase()}</span>}
      <span className="ps5-title-name">{name}</span>
    </div>
  );
}

/** "Manufacturer · Year" under the hero logo; nothing when both are missing. */
export function HeroMeta({ info }: { info: ThemeSystemInfo | null }) {
  const meta = [info?.manufacturer, info?.releaseYear].filter(Boolean).join(' · ');
  if (!meta) return null;
  return <div className="ps5-hero-meta">{meta}</div>;
}

function Stat({
  kind,
  label,
  value,
  icon,
}: {
  kind: string;
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className={`ps5-stat ps5-stat--${kind}`}>
      {icon && <span className="ps5-stat-icon">{icon}</span>}
      <div className="ps5-stat-text">
        <div className="ps5-stat-label">{label}</div>
        <div className="ps5-stat-value">{value}</div>
      </div>
    </div>
  );
}

/** Games and Favorites for a system, Items for a menu node; "…" while loading, hidden if unknown. */
export function HomeStats({ count }: { count: GameCountState }) {
  const { t, i18n } = useTranslation();
  if (!count) return null;
  const format = (n: number) => new Intl.NumberFormat(i18n.language).format(n);
  if (count.kind === 'items') {
    return (
      <div className="ps5-stats">
        <Stat kind="items" label={t('themes.ps5.items')} value={format(count.count)} />
      </div>
    );
  }
  if (count.count === null && !count.loading) return null;
  const games = count.count === null ? '…' : format(count.count);
  const favorites =
    count.favorites === null
      ? '…'
      : count.favorites === 0
        ? t('themes.ps5.none')
        : format(count.favorites);
  return (
    <div className="ps5-stats">
      <Stat
        kind="games"
        label={t('themes.ps5.games')}
        value={games}
        icon={<TrophyIcon size={28} />}
      />
      <Stat kind="favorites" label={t('themes.ps5.favorites')} value={favorites} />
    </div>
  );
}
