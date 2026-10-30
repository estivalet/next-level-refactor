import {
  addEmulator,
  addPresetProfiles,
  type EmulatorPreset,
  type Settings,
} from '@nextlevel/shared';
import { getPresetProfile, getSystem, presetForExecutable } from '@nextlevel/system-catalog';

/** The preset a system plays best with (its first preset profile), for its Official site. */
export function bestPreset(systemId: string): EmulatorPreset | undefined {
  const first = getSystem(systemId)?.presetProfiles[0];
  return first ? getPresetProfile(first)?.preset : undefined;
}

const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const coversSystem = (preset: EmulatorPreset | undefined, systemId: string) =>
  preset?.profiles.some((profile) => profile.systems.includes(systemId)) ?? false;

/**
 * Settings after the player points at an emulator program for a system (US-B1, D48), so that
 * the system plays: the system is enabled, and the program gets the preset profiles that cover
 * it — added to the emulator already set up for that program, or as a new emulator. The preset is
 * the one the program's file name matches, else the system's best preset for an unknown program.
 * A known program that doesn't play the system is refused.
 */
export function emulatorForSystem(
  settings: Settings,
  systemId: string,
  executable: string,
  newId: () => string,
): { settings: Settings } | { refused: 'doesNotPlay' } {
  const byName = presetForExecutable(fileName(executable));
  const preset = byName ?? bestPreset(systemId);
  if (!preset || !coversSystem(preset, systemId)) return { refused: 'doesNotPlay' };
  const enabled: Settings = {
    ...settings,
    systems: {
      ...settings.systems,
      [systemId]: { ...settings.systems[systemId], enabled: true },
    },
  };
  const same = settings.emulators.find(
    (emulator) => emulator.executable.toLowerCase() === executable.toLowerCase(),
  );
  if (!same) return { settings: addEmulator(enabled, { preset, executable, newId }) };
  const covered = settings.profiles.some(
    (profile) => profile.emulatorId === same.id && profile.systems.includes(systemId),
  );
  if (covered) return { settings: enabled };
  const missing = preset.profiles
    .filter((profile) => profile.systems.includes(systemId))
    .map((profile) => profile.id);
  return { settings: addPresetProfiles(enabled, same.id, missing, preset, newId) };
}
