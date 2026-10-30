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
 * An unknown program gets no preset (another emulator's arguments would be wrong): a profile for
 * the system that passes only the ROM, on the emulator already set up for it or a new one.
 */
function plainProfile(
  settings: Settings,
  systemId: string,
  executable: string,
  emulatorId: string | undefined,
  newId: () => string,
): Settings {
  const added = emulatorId ? settings : addEmulator(settings, { executable, newId });
  const emulator =
    emulatorId ?? added.emulators.find((e) => e.executable === executable)?.id ?? newId();
  return {
    ...added,
    profiles: [
      ...added.profiles,
      {
        id: newId(),
        name: getSystem(systemId)?.name ?? systemId,
        emulatorId: emulator,
        systems: [systemId],
        args: ['{rom}'],
        archives: 'pass',
        env: {},
      },
    ],
  };
}

/**
 * Settings after the player points at an emulator program for a system (US-B1, D48), so that
 * the system plays: the system is enabled, and the program gets the preset profiles that cover
 * it — added to the emulator already set up for that program, or as a new emulator. The preset is
 * the one the program's file name matches; an unknown program gets a plain ROM-only profile.
 * A known program that doesn't play the system is refused.
 */
export function emulatorForSystem(
  settings: Settings,
  systemId: string,
  executable: string,
  newId: () => string,
): { settings: Settings } | { refused: 'doesNotPlay' } {
  const preset = presetForExecutable(fileName(executable));
  if (preset && !coversSystem(preset, systemId)) return { refused: 'doesNotPlay' };
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
  if (!preset) return { settings: plainProfile(enabled, systemId, executable, same?.id, newId) };
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
