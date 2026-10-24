import {
  emulatorNameFor,
  normalizePath,
  profileFromPreset,
  type DetectedEmulator,
  type EmulatorPreset,
  type ImportItem,
  type Settings,
  type SystemDefinition,
} from '@nextlevel/shared';

/**
 * Emulators found in the import's emulators folder → profiles (D14). Only enabled systems without
 * any profile get one: the first of the system's preset profiles whose emulator was found, which
 * also becomes its default. An emulator is added once (by executable path) and only when it
 * brings a profile, so running the import again changes nothing.
 */
export function addDetectedProfiles(
  settings: Settings,
  detected: readonly DetectedEmulator[],
  catalog: readonly SystemDefinition[],
  presets: readonly EmulatorPreset[],
  newId: () => string,
): { next: Settings; items: ImportItem[] } {
  const known = new Set(settings.emulators.map((e) => normalizePath(e.executable)));
  const found = new Map<string, DetectedEmulator>();
  for (const emulator of detected) {
    if (!known.has(normalizePath(emulator.executable)) && !found.has(emulator.presetId)) {
      found.set(emulator.presetId, emulator);
    }
  }
  const covered = new Set(settings.profiles.flatMap((p) => p.systems));
  const presetById = new Map(presets.map((preset) => [preset.id, preset]));
  // preset id → system id → preset profile id
  const wanted = new Map<string, Map<string, string>>();
  for (const system of catalog) {
    if (!settings.systems[system.id]?.enabled || covered.has(system.id)) continue;
    for (const profileId of system.presetProfiles) {
      const preset = presets.find((p) => p.profiles.some((profile) => profile.id === profileId));
      if (!preset || !found.has(preset.id)) continue;
      const systems = wanted.get(preset.id) ?? new Map<string, string>();
      systems.set(system.id, profileId);
      wanted.set(preset.id, systems);
      break;
    }
  }

  const items: ImportItem[] = [];
  let next = settings;
  for (const [presetId, systemProfiles] of wanted) {
    const preset = presetById.get(presetId);
    const emulator = found.get(presetId);
    if (!preset || !emulator) continue;
    const emulatorId = newId();
    const profiles = [...new Set(systemProfiles.values())].flatMap((profileId) => {
      const profile = preset.profiles.find((p) => p.id === profileId);
      return profile ? [profileFromPreset(profile, emulatorId, newId())] : [];
    });
    const systems = { ...next.systems };
    for (const [systemId, profileId] of systemProfiles) {
      const own = systems[systemId];
      const profile = profiles.find((p) => p.presetProfileId === profileId);
      if (own && profile && !own.defaultProfileId) {
        systems[systemId] = { ...own, defaultProfileId: profile.id };
      }
    }
    next = {
      ...next,
      emulators: [
        ...next.emulators,
        {
          id: emulatorId,
          name: emulatorNameFor(emulator.executable, preset),
          presetId,
          executable: emulator.executable,
        },
      ],
      profiles: [...next.profiles, ...profiles],
      systems,
    };
    items.push({
      area: 'emulator',
      key: preset.name,
      reason: 'emulatorAdded',
      detail: emulator.executable,
      count: profiles.length,
    });
  }
  return { next, items };
}
