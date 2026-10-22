import type { EmulatorProfile } from '../settings/emulators.ts';
import type { Settings } from '../settings/schema.ts';

/** The profiles that can run a system's games, in list order (FR-EMU-4). */
export function profilesFor(settings: Settings, systemId: string): EmulatorProfile[] {
  return settings.profiles.filter((profile) => profile.systems.includes(systemId));
}

/**
 * The profile a system's games use without a per-game override (data model §2.3): the system
 * default while it still covers the system, else the first profile covering it.
 */
export function defaultProfileFor(
  settings: Settings,
  systemId: string,
): EmulatorProfile | undefined {
  const covering = profilesFor(settings, systemId);
  const chosen = settings.systems[systemId]?.defaultProfileId;
  return covering.find((profile) => profile.id === chosen) ?? covering[0];
}
