import { normalizePath, type StorageLocation } from './schema.ts';

/** Whether `inner` is `outer` or a folder inside it (both normalized). */
function within(inner: string, outer: string): boolean {
  return inner === outer || inner.startsWith(`${outer}\\`);
}

/**
 * The user's own storage locations the Catalog games folder (D45) is, is inside, or contains
 * (FR-CAT-3): Catalog installs and uninstalls there would mix with their ROMs. Case- and
 * slash-insensitive; `E:\Roms2` is not inside `E:\Roms`.
 */
export function catalogOverlaps(locations: readonly StorageLocation[]): StorageLocation[] {
  const managed = locations.find((location) => location.managed);
  if (!managed) return [];
  const catalog = normalizePath(managed.path);
  return locations.filter((location) => {
    if (location.managed) return false;
    const path = normalizePath(location.path);
    return within(catalog, path) || within(path, catalog);
  });
}
