import { orderedLocations, type Settings, type SystemDefinition } from '@nextlevel/shared';
import { join } from 'node:path';

export interface ExpectedPathInput {
  settings: Settings;
  system: SystemDefinition | undefined;
  systemId: string;
  locationId: string | null;
  relPath: string;
}

/**
 * Where a missing game's file should be (FR-LIB-4): its location, or the first one when that
 * location was removed, then the system folder, then the rel_path. Without any location only the
 * rel_path is known.
 */
export function expectedGamePath(input: ExpectedPathInput): string {
  const locations = orderedLocations(input.settings.storage.locations);
  const location = locations.find((candidate) => candidate.id === input.locationId) ?? locations[0];
  if (!location) return input.relPath;
  const folder =
    input.settings.systems[input.systemId]?.folderName ??
    input.system?.defaultFolderName ??
    input.systemId;
  return join(location.path, folder, ...input.relPath.split('/'));
}
