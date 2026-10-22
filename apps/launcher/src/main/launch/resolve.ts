import {
  defaultProfileFor,
  type Emulator,
  type EmulatorProfile,
  type LaunchOverride,
  type Settings,
} from '@nextlevel/shared';
import { launchError } from './errors.ts';

/**
 * The profile that runs a game (data model §2.3): the game's override, then the system default,
 * then the first profile covering the system. Ids that no longer exist, or whose profile no longer
 * covers the system, fall through.
 */
export function resolveProfile(
  settings: Settings,
  systemId: string,
  override: LaunchOverride,
): { profile: EmulatorProfile; emulator: Emulator } {
  const overridden = override.profileId
    ? settings.profiles.find(
        (profile) => profile.id === override.profileId && profile.systems.includes(systemId),
      )
    : undefined;
  const profile = overridden ?? defaultProfileFor(settings, systemId);
  if (!profile) throw launchError('NO_PROFILE', { fix: { section: 'systems', id: systemId } });
  const emulator = settings.emulators.find((candidate) => candidate.id === profile.emulatorId);
  if (!emulator) {
    throw launchError('EMULATOR_MISSING', { fix: { section: 'emulators', id: profile.id } });
  }
  return { profile, emulator };
}
