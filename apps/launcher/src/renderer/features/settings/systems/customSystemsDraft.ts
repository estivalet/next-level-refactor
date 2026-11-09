import { customSystemId, type CustomSystem, type Settings } from '@nextlevel/shared';

/** A system name as a ROM folder name: characters Windows forbids are dropped (FR-EMU-11). */
export function folderNameFrom(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'System'
  );
}

/**
 * Adds a custom system (FR-EMU-11) and turns it on. `takenIds` are every id in use (shipped and
 * custom), so the new id is unique.
 */
export function withNewCustomSystem(
  settings: Settings,
  input: { name: string; extensions: string[] },
  takenIds: Iterable<string>,
): { settings: Settings; id: string } {
  const name = input.name.trim();
  const id = customSystemId(name, takenIds);
  const system: CustomSystem = {
    id,
    name,
    kind: 'console',
    folderName: folderNameFrom(name),
    extensions: input.extensions,
  };
  return {
    id,
    settings: {
      ...settings,
      customSystems: [...settings.customSystems, system],
      systems: { ...settings.systems, [id]: { enabled: true } },
    },
  };
}

export type CustomSystemPatch = {
  [K in Exclude<keyof CustomSystem, 'id'>]?: CustomSystem[K] | undefined;
};

/** Changes one custom system; keys set to undefined are removed. */
export function withCustomSystemPatch(
  settings: Settings,
  id: string,
  patch: CustomSystemPatch,
): Settings {
  return {
    ...settings,
    customSystems: settings.customSystems.map((system) =>
      system.id === id
        ? (Object.fromEntries(
            Object.entries({ ...system, ...patch }).filter(([, value]) => value !== undefined),
          ) as CustomSystem)
        : system,
    ),
  };
}

/**
 * Removes a custom system with its settings, and its id from emulator profiles. A profile that
 * covers only this system keeps the id: a profile needs at least one system, and the user fixes
 * it in Settings → Emulators.
 */
export function withoutCustomSystem(settings: Settings, id: string): Settings {
  const systems = Object.fromEntries(
    Object.entries(settings.systems).filter(([key]) => key !== id),
  );
  return {
    ...settings,
    customSystems: settings.customSystems.filter((system) => system.id !== id),
    systems,
    profiles: settings.profiles.map((profile) =>
      profile.systems.includes(id) && profile.systems.length > 1
        ? { ...profile, systems: profile.systems.filter((system) => system !== id) }
        : profile,
    ),
  };
}
