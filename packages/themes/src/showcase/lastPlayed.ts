// Ported from NextLevelOS src/themes/showcase/lastPlayed.ts @ 3d530b7: reads the ISO
// `lastPlayedAt` and returns how long ago, so the wording can go through i18n.
import type { TFunction } from 'i18next';

export type LastPlayed =
  | { unit: 'now' }
  | { unit: 'minutes' | 'hours' | 'days'; count: number }
  | { unit: 'date'; date: Date };

/**
 * How long ago a game was last played: minutes, hours, then days; after 30 days the date. A date
 * in the future counts as just now. Null when missing or unparsable.
 */
export function lastPlayed(lastPlayedAt: string | null, now: Date = new Date()): LastPlayed | null {
  if (!lastPlayedAt) return null;
  const at = new Date(lastPlayedAt);
  const t = at.getTime();
  if (Number.isNaN(t)) return null;
  const mins = Math.floor((now.getTime() - t) / 60000);
  if (mins < 1) return { unit: 'now' };
  if (mins < 60) return { unit: 'minutes', count: mins };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { unit: 'hours', count: hours };
  const days = Math.floor(hours / 24);
  if (days < 30) return { unit: 'days', count: days };
  return { unit: 'date', date: at };
}

/** The i18n text of `lastPlayed`, or null. */
export function lastPlayedLabel(
  played: LastPlayed | null,
  t: TFunction,
  language: string,
): string | null {
  if (!played) return null;
  if (played.unit === 'now') return t('themes.showcase.lastPlayed.now');
  if (played.unit === 'date') {
    const date = new Intl.DateTimeFormat(language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(played.date);
    return t('themes.showcase.lastPlayed.date', { date });
  }
  return t(`themes.showcase.lastPlayed.${played.unit}`, { count: played.count });
}
