import type { Settings } from '@nextlevel/shared';

/**
 * D48: an install that already has a storage location or games never sees the first-run wizard.
 * Answers the settings with `setupCompletedAt` set, or null when nothing changes.
 */
export function markExistingSetupComplete(
  settings: Settings,
  gameCount: number,
  now: Date,
): Settings | null {
  if (settings.general.setupCompletedAt !== null) return null;
  if (settings.storage.locations.length === 0 && gameCount === 0) return null;
  return { ...settings, general: { ...settings.general, setupCompletedAt: now.toISOString() } };
}
