import type { Settings } from '@nextlevel/shared';
import type { SettingsService } from './SettingsService.ts';

/**
 * D48: an install that already has a storage location or games never sees the first-run wizard,
 * unless the player asked for it again (Settings → General → Run setup again).
 * Answers the settings with `setupCompletedAt` set, or null when nothing changes.
 */
export function markExistingSetupComplete(
  settings: Settings,
  gameCount: number,
  now: Date,
): Settings | null {
  if (settings.general.setupCompletedAt !== null || settings.general.setupRequested) return null;
  if (settings.storage.locations.length === 0 && gameCount === 0) return null;
  return { ...settings, general: { ...settings.general, setupCompletedAt: now.toISOString() } };
}

/**
 * At boot, before the window opens (so the renderer never reads the old value): marks an existing
 * install complete. `skip` (e2e, development builds only) marks any install complete.
 */
export async function markSetupAtBoot(
  settings: SettingsService,
  gameCount: number,
  opts: { skip: boolean; log: { warn(context: object, msg: string): void } },
): Promise<void> {
  const loaded = settings.get();
  if (loaded.kind !== 'ok') return;
  const counted = opts.skip ? Number.MAX_SAFE_INTEGER : gameCount;
  if (!markExistingSetupComplete(loaded.snapshot.settings, counted, new Date())) return;
  const saved = await settings.update(
    (current) => markExistingSetupComplete(current, counted, new Date()) ?? current,
  );
  if (!saved.ok) opts.log.warn({ code: saved.error.code }, 'could not mark setup complete');
}
