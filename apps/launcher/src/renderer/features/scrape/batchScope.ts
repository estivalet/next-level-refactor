import type { BatchStatus } from '@nextlevel/shared';
import type { TFunction } from 'i18next';

/**
 * What a batch job covers, for the strip and the details panel (FR-SCR-8): the system's name,
 * "n systems", or "selected games" for a selection job.
 */
export function scopeLabel(
  systemIds: BatchStatus['systemIds'],
  nameOf: (id: string) => string,
  t: TFunction,
): string {
  if (!systemIds) return t('library.batch.scopeSelection');
  const [only] = systemIds;
  if (systemIds.length === 1 && only !== undefined) return nameOf(only);
  return t('library.batch.scopeSystems', { count: systemIds.length });
}
