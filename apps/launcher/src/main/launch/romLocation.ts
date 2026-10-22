import { orderedLocations, type Settings, type SystemDefinition } from '@nextlevel/shared';
import { win32 } from 'node:path';
import { launchError } from './errors.ts';

export interface RomLookup {
  settings: Settings;
  system: SystemDefinition | undefined;
  systemId: string;
  relPath: string;
  locationId: string | null;
}

function folderName(settings: Settings, system: SystemDefinition | undefined, systemId: string) {
  return settings.systems[systemId]?.folderName ?? system?.defaultFolderName ?? systemId;
}

/**
 * Where a game's file is now (data model §2.4): its own storage location first, then the others
 * by priority; the first file that exists wins.
 */
export function locateRom(
  lookup: RomLookup,
  exists: (path: string) => boolean,
): { path: string; systemDir: string } {
  const locations = orderedLocations(lookup.settings.storage.locations);
  const own = locations.filter((location) => location.id === lookup.locationId);
  const others = locations.filter((location) => location.id !== lookup.locationId);
  const folder = folderName(lookup.settings, lookup.system, lookup.systemId);
  const candidates = [...own, ...others].map((location) => {
    const systemDir = win32.join(location.path, folder);
    return { path: win32.join(systemDir, ...lookup.relPath.split('/')), systemDir };
  });
  const found = candidates.find((candidate) => exists(candidate.path));
  if (found) return found;
  throw launchError('ROM_MISSING', {
    path: candidates[0]?.path ?? lookup.relPath,
    fix: { section: 'storage' },
  });
}

/** An example ROM path for previews without a chosen game (FR-EMU-5). */
export function sampleRom(
  settings: Settings,
  system: SystemDefinition | undefined,
  systemId: string,
): { path: string; systemDir: string } {
  const base = orderedLocations(settings.storage.locations)[0]?.path ?? 'C:\\Games';
  const systemDir = win32.join(base, folderName(settings, system, systemId));
  const extension = settings.systems[systemId]?.extensions?.[0] ?? system?.extensions[0] ?? 'zip';
  return { path: win32.join(systemDir, `Example Game (USA).${extension}`), systemDir };
}
