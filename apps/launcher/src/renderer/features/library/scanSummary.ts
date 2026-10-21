import type { ScanSummary } from '@nextlevel/shared';
import type { TFunction } from 'i18next';

/** "2 games in 1 system · 1 new · 1 missing · 1 system turned on" (zero counts are left out). */
export function summaryLine(t: TFunction, summary: ScanSummary): string {
  const total = (key: 'present' | 'added' | 'moved' | 'restored' | 'missing') =>
    summary.systems.reduce((sum, system) => sum + system[key], 0);
  const parts = [
    `${t('settings.storage.scan.games', { count: total('present') })} ${t(
      'settings.storage.scan.inSystems',
      { count: summary.systems.length },
    )}`,
  ];
  for (const key of ['added', 'moved', 'restored', 'missing'] as const) {
    const count = total(key);
    if (count > 0) parts.push(t(`settings.storage.scan.${key}`, { count }));
  }
  if (summary.enabledSystemIds.length > 0) {
    parts.push(t('settings.storage.scan.enabled', { count: summary.enabledSystemIds.length }));
  }
  return parts.join(' · ');
}
