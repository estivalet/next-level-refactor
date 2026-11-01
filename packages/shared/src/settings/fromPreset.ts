import type { EmulatorPreset, PresetProfile } from '../catalog/schema.ts';
import type { EmulatorProfile } from './emulators.ts';
import { normalizePath, type Settings, type SystemSettings } from './schema.ts';

/** The file name without folder and extension: `C:\Emu\my-emu.exe` → `my-emu`. */
function baseName(path: string): string {
  return (path.split(/[\\/]/).pop() ?? path).replace(/\.[^.]+$/, '');
}

export function emulatorNameFor(executable: string, preset: EmulatorPreset | undefined): string {
  return preset?.name ?? baseName(executable);
}

/** A preset profile as a profile of `emulatorId` (FR-EMU-7). */
export function profileFromPreset(
  preset: PresetProfile,
  emulatorId: string,
  id: string,
): EmulatorProfile {
  return {
    id,
    name: preset.name,
    emulatorId,
    systems: [...preset.systems],
    args: [...preset.args],
    ...(preset.cwd ? { cwd: preset.cwd } : {}),
    ...(preset.core ? { core: preset.core } : {}),
    archives: preset.archives,
    env: { ...preset.env },
    presetProfileId: preset.id,
  };
}

/**
 * Adds an emulator (FR-EMU-2). From a preset it also gets the preset profiles that cover an
 * enabled system (FR-EMU-7); the rest can be added later with Add from preset. A program already
 * set up is not added again: it gets only the preset profiles it doesn't have yet.
 */
export function addEmulator(
  settings: Settings,
  input: { preset?: EmulatorPreset | undefined; executable: string; newId: () => string },
): Settings {
  const { preset, executable, newId } = input;
  const same = settings.emulators.find(
    (emulator) => normalizePath(emulator.executable) === normalizePath(executable),
  );
  const emulatorId = same?.id ?? newId();
  const enabled = new Set(
    Object.entries(settings.systems)
      .filter(([, system]) => system.enabled)
      .map(([id]) => id),
  );
  const have = new Set(
    settings.profiles.filter((p) => p.emulatorId === emulatorId).map((p) => p.presetProfileId),
  );
  const profiles = (preset?.profiles ?? [])
    .filter((profile) => !have.has(profile.id))
    .filter((profile) => profile.systems.some((id) => enabled.has(id)))
    .map((profile) => profileFromPreset(profile, emulatorId, newId()));
  return {
    ...settings,
    emulators: same
      ? settings.emulators
      : [
          ...settings.emulators,
          {
            id: emulatorId,
            name: emulatorNameFor(executable, preset),
            ...(preset ? { presetId: preset.id } : {}),
            executable,
          },
        ],
    profiles: [...settings.profiles, ...profiles],
  };
}

/** A profile's settings without its ids, keys sorted, for comparing copies. */
function profileContent(profile: EmulatorProfile): string {
  return JSON.stringify(
    Object.entries({ ...profile, id: '', emulatorId: '' }).sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * One emulator per program: later records of the same program are merged into the first, which
 * takes over their profiles. An identical copy of a preset profile is dropped, keeping the copy a
 * system default names; an edited copy is kept.
 */
export function mergeDuplicateEmulators(settings: Settings): Settings {
  const firstOf = new Map<string, string>();
  const mergedInto = new Map<string, string>();
  for (const emulator of settings.emulators) {
    const program = normalizePath(emulator.executable);
    const first = firstOf.get(program);
    if (first) mergedInto.set(emulator.id, first);
    else firstOf.set(program, emulator.id);
  }
  if (mergedInto.size === 0) return settings;

  const defaults = new Set(Object.values(settings.systems).map((s) => s.defaultProfileId));
  const profiles = settings.profiles.map((p) => ({
    ...p,
    emulatorId: mergedInto.get(p.emulatorId) ?? p.emulatorId,
  }));
  // Copies a default names come first, so they are the ones kept.
  const preferred = [...profiles].sort(
    (a, b) => Number(defaults.has(b.id)) - Number(defaults.has(a.id)),
  );
  const kept: EmulatorProfile[] = [];
  const replacedBy = new Map<string, string>();
  for (const profile of preferred) {
    const twin = profile.presetProfileId
      ? kept.find(
          (k) =>
            k.emulatorId === profile.emulatorId && profileContent(k) === profileContent(profile),
        )
      : undefined;
    if (twin) replacedBy.set(profile.id, twin.id);
    else kept.push(profile);
  }
  const systems = Object.fromEntries(
    Object.entries(settings.systems).map(([id, system]): [string, SystemSettings] => {
      const replacement = system.defaultProfileId && replacedBy.get(system.defaultProfileId);
      return [id, replacement ? { ...system, defaultProfileId: replacement } : system];
    }),
  );
  return {
    ...settings,
    emulators: settings.emulators.filter((emulator) => !mergedInto.has(emulator.id)),
    profiles: profiles.filter((profile) => !replacedBy.has(profile.id)),
    systems,
  };
}

/** Preset profiles this emulator doesn't have yet. */
export function remainingPresetProfiles(
  preset: EmulatorPreset,
  emulatorId: string,
  profiles: readonly EmulatorProfile[],
): PresetProfile[] {
  const used = new Set(
    profiles.filter((p) => p.emulatorId === emulatorId).map((p) => p.presetProfileId),
  );
  return preset.profiles.filter((profile) => !used.has(profile.id));
}

export function addPresetProfiles(
  settings: Settings,
  emulatorId: string,
  presetProfileIds: readonly string[],
  preset: EmulatorPreset,
  newId: () => string,
): Settings {
  const chosen = preset.profiles.filter((profile) => presetProfileIds.includes(profile.id));
  return {
    ...settings,
    profiles: [
      ...settings.profiles,
      ...chosen.map((p) => profileFromPreset(p, emulatorId, newId())),
    ],
  };
}

/** System settings without defaults that point at removed profiles. */
function withoutDefaults(
  systems: Settings['systems'],
  removed: ReadonlySet<string>,
): Settings['systems'] {
  return Object.fromEntries(
    Object.entries(systems).map(([id, system]): [string, SystemSettings] => {
      if (!system.defaultProfileId || !removed.has(system.defaultProfileId)) return [id, system];
      const rest = { ...system };
      delete rest.defaultProfileId;
      return [id, rest];
    }),
  );
}

/** Deletes an emulator with its profiles; system defaults naming them are cleared (FR-EMU-4). */
export function removeEmulator(settings: Settings, emulatorId: string): Settings {
  const removed = new Set(
    settings.profiles.filter((p) => p.emulatorId === emulatorId).map((p) => p.id),
  );
  return {
    ...settings,
    emulators: settings.emulators.filter((emulator) => emulator.id !== emulatorId),
    profiles: settings.profiles.filter((profile) => !removed.has(profile.id)),
    systems: withoutDefaults(settings.systems, removed),
  };
}

export function removeProfile(settings: Settings, profileId: string): Settings {
  return {
    ...settings,
    profiles: settings.profiles.filter((profile) => profile.id !== profileId),
    systems: withoutDefaults(settings.systems, new Set([profileId])),
  };
}
