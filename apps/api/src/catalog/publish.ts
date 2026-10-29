import type { LicenseState, PublishBlocker } from '@nextlevel/shared';
import type { catalogFiles, catalogItems, licenses } from '../db/schema.ts';

type ItemRow = typeof catalogItems.$inferSelect;
type LicenseRow = typeof licenses.$inferSelect;
type FileRow = typeof catalogFiles.$inferSelect;

/**
 * Why an item can't be published (C10, D44): it needs a verified license in its dates, an
 * `on_lapse` choice and at least one ready `rom`/`disc` file. Empty: publishable.
 */
export function publishBlockers(
  item: Pick<ItemRow, 'onLapse'>,
  license: LicenseRow | undefined,
  files: readonly FileRow[],
  now: Date,
): PublishBlocker[] {
  const blockers: PublishBlocker[] = [];
  if (!license) blockers.push('license');
  else if (license.verifiedAt === null) blockers.push('licenseUnverified');
  else if (license.startsAt !== null && Date.parse(license.startsAt) > now.getTime()) {
    blockers.push('licenseNotStarted');
  } else if (license.expiresAt !== null && Date.parse(license.expiresAt) <= now.getTime()) {
    blockers.push('licenseExpired');
  }
  if (item.onLapse === null) blockers.push('onLapse');
  if (!files.some((file) => file.status === 'ready' && file.role !== 'extra')) {
    blockers.push('files');
  }
  return blockers;
}

/** The console list's license column (S13). */
export function licenseState(
  license: Pick<LicenseRow, 'verifiedAt' | 'startsAt' | 'expiresAt'> | undefined | null,
  now: Date,
): LicenseState {
  if (!license) return 'none';
  if (license.expiresAt !== null && Date.parse(license.expiresAt) <= now.getTime()) {
    return 'expired';
  }
  if (license.verifiedAt === null) return 'unverified';
  if (license.startsAt !== null && Date.parse(license.startsAt) > now.getTime()) {
    return 'notStarted';
  }
  return 'verified';
}
