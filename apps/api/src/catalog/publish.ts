import type { PublishBlocker } from '@nextlevel/shared';
import type { catalogFiles, catalogItems, licenses } from '../db/schema.ts';

type ItemRow = typeof catalogItems.$inferSelect;
type LicenseRow = typeof licenses.$inferSelect;
type FileRow = typeof catalogFiles.$inferSelect;

/**
 * Why an item can't be published (C10, D44): it needs a verified, unexpired license, an
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
  else if (license.expiresAt !== null && Date.parse(license.expiresAt) <= now.getTime()) {
    blockers.push('licenseExpired');
  }
  if (item.onLapse === null) blockers.push('onLapse');
  if (!files.some((file) => file.status === 'ready' && file.role !== 'extra')) {
    blockers.push('files');
  }
  return blockers;
}
