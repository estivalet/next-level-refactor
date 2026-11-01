import {
  emulatorNameFor,
  normalizePath,
  profileFromPreset,
  type DetectedEmulator,
  type Emulator,
  type EmulatorPreset,
  type ImportItem,
  type Settings,
} from '@nextlevel/shared';

/** A preset profile an imported game runs with, for its system. */
export interface WantedProfile {
  systemId: string;
  presetProfileId: string;
}

/** The profile copied from `presetProfileId` that covers the system, if any. */
export function profileIdFor(
  settings: Settings,
  systemId: string,
  presetProfileId: string,
): string | null {
  const profile = settings.profiles.find(
    (p) => p.presetProfileId === presetProfileId && p.systems.includes(systemId),
  );
  return profile?.id ?? null;
}

/**
 * The preset profiles imported games run with (their own emulator or MAME medium) that aren't
 * set up yet: each is copied from its preset for the systems that want it; a copy that exists
 * gains the systems it lacks. The preset's emulator is the one set up here, else the one the
 * emulators folder holds (added, as D14 adds them). System defaults don't change. A wanted
 * emulator found nowhere is reported, once per emulator.
 */
export function addPresetProfiles(
  settings: Settings,
  wanted: readonly WantedProfile[],
  presets: readonly EmulatorPreset[],
  newId: () => string,
  detected: readonly DetectedEmulator[] = [],
): { next: Settings; items: ImportItem[] } {
  const systemsBy = new Map<string, string[]>();
  for (const { systemId, presetProfileId } of wanted) {
    const systems = systemsBy.get(presetProfileId) ?? [];
    if (!systems.includes(systemId)) systems.push(systemId);
    systemsBy.set(presetProfileId, systems);
  }
  let { emulators, profiles } = settings;
  const missing = new Map<string, number>();
  const emulatorFor = (preset: EmulatorPreset): Emulator | undefined => {
    const own = emulators.find((e) => e.presetId === preset.id);
    if (own) return own;
    const found = detected.find((d) => d.presetId === preset.id);
    const known = new Set(emulators.map((e) => normalizePath(e.executable)));
    if (!found || known.has(normalizePath(found.executable))) return undefined;
    const added: Emulator = {
      id: newId(),
      name: emulatorNameFor(found.executable, preset),
      presetId: preset.id,
      executable: found.executable,
    };
    emulators = [...emulators, added];
    return added;
  };
  for (const [presetProfileId, systems] of systemsBy) {
    const preset = presets.find((p) => p.id === presetProfileId.split(':')[0]);
    const source = preset?.profiles.find((p) => p.id === presetProfileId);
    if (!preset || !source) continue;
    const emulator = emulatorFor(preset);
    if (!emulator) {
      missing.set(preset.name, (missing.get(preset.name) ?? 0) + systems.length);
      continue;
    }
    const existing = profiles.find(
      (p) => p.presetProfileId === presetProfileId && p.emulatorId === emulator.id,
    );
    if (!existing) {
      profiles = [...profiles, { ...profileFromPreset(source, emulator.id, newId()), systems }];
      continue;
    }
    const lacking = systems.filter((id) => !existing.systems.includes(id));
    if (lacking.length === 0) continue;
    profiles = profiles.map((p) =>
      p.id === existing.id ? { ...p, systems: [...p.systems, ...lacking] } : p,
    );
  }
  const items = [...missing].map(([key, count]): ImportItem => ({
    area: 'emulator',
    key,
    reason: 'presetEmulatorMissing',
    count,
  }));
  const unchanged = profiles === settings.profiles && emulators === settings.emulators;
  return { next: unchanged ? settings : { ...settings, emulators, profiles }, items };
}
