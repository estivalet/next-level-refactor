import { SystemCatalogSchema, type SystemDefinition, type SystemSettings } from '@nextlevel/shared';
import data from '../data/systems.json' with { type: 'json' };

/** Every system NextLevelOS knew about when the catalog was seeded (see README). */
export const NEXTLEVELOS_SYSTEM_COUNT = 438;

let cache: readonly SystemDefinition[] | undefined;

/** The shipped system catalog, validated once (FR-EMU-1). */
export function systemCatalog(): readonly SystemDefinition[] {
  cache ??= SystemCatalogSchema.parse(data).systems;
  return cache;
}

export function getSystem(id: string): SystemDefinition | undefined {
  return systemCatalog().find((system) => system.id === id);
}

/** A system's folder name and extensions after the user's overrides (FR-LIB-2). */
export function effectiveSystem(
  def: SystemDefinition,
  settings?: SystemSettings,
): { folderName: string; extensions: string[]; enabled: boolean } {
  return {
    folderName: settings?.folderName ?? def.defaultFolderName,
    extensions: settings?.extensions ?? def.extensions,
    enabled: settings?.enabled ?? false,
  };
}
