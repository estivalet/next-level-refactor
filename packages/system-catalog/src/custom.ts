import type { CustomSystem, SystemDefinition } from '@nextlevel/shared';

/** A user-added system (FR-EMU-11) as a catalog definition: no presets, no aliases. */
export function customSystemDefinition(system: CustomSystem): SystemDefinition {
  const optional = <K extends keyof CustomSystem>(key: K) =>
    system[key] === undefined ? {} : { [key]: system[key] };
  return {
    id: system.id,
    name: system.name,
    ...optional('shortName'),
    ...optional('manufacturer'),
    ...optional('releaseYear'),
    kind: system.kind,
    ...optional('description'),
    extensions: system.extensions,
    defaultFolderName: system.folderName,
    scraper: {
      ...optional('screenscraperId'),
      ...optional('launchboxPlatform'),
    },
    presetProfiles: [],
    aliases: [],
  };
}

/** The shipped catalog followed by the user's systems (FR-EMU-11). */
export function withCustomSystems(
  catalog: readonly SystemDefinition[],
  custom: readonly CustomSystem[],
): readonly SystemDefinition[] {
  return custom.length === 0 ? catalog : [...catalog, ...custom.map(customSystemDefinition)];
}

export function findSystem(
  systems: readonly SystemDefinition[],
  id: string,
): SystemDefinition | undefined {
  return systems.find((system) => system.id === id);
}
