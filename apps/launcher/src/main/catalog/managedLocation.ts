import { orderedLocations, type Settings, type StorageLocation } from '@nextlevel/shared';
import { join } from 'node:path';

const withLocations = (settings: Settings, locations: StorageLocation[]): Settings => ({
  ...settings,
  storage: { ...settings.storage, locations: orderedLocations(locations) },
});

/** "<name> (old)", or "(old 2)", "(old 3)"… when that name is taken (names are unique). */
function oldName(name: string, locations: readonly StorageLocation[]): string {
  const taken = new Set(locations.map((location) => location.name.toLowerCase()));
  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? ' (old)' : ` (old ${String(n)})`;
    const candidate = `${name.slice(0, 40 - suffix.length)}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** The managed location last (D45), priorities renumbered. */
function managedLast(locations: readonly StorageLocation[]): StorageLocation[] {
  return orderedLocations([
    ...locations.filter((location) => !location.managed),
    ...locations.filter((location) => location.managed),
  ]);
}

/**
 * The Catalog games folder (D45): the managed storage location, added as
 * `<NextLevel folder>\Catalog` (D50: never Documents) when settings have none.
 */
export function ensureManagedLocation(
  settings: Settings,
  root: string,
  newId: () => string,
): { settings: Settings; location: StorageLocation; added: boolean } {
  const existing = settings.storage.locations.find((location) => location.managed);
  if (existing) return { settings, location: existing, added: false };
  const location: StorageLocation = {
    id: newId(),
    name: 'Catalog',
    path: join(root, 'Catalog'),
    priority: settings.storage.locations.length + 1,
    managed: true,
  };
  const next = withLocations(settings, managedLast([...settings.storage.locations, location]));
  return {
    settings: next,
    location: next.storage.locations.find((l) => l.id === location.id) ?? location,
    added: true,
  };
}

/**
 * Settings → Storage saves (D45): changing the Catalog folder affects new installs only, so the
 * old folder stays as an ordinary location (same id: installed games keep resolving, renamed
 * "<name> (old)") and the new path becomes a new managed location. The managed one is kept last.
 */
export function keepManagedHistory(
  previous: Settings,
  next: Settings,
  newId: () => string,
): Settings {
  const before = previous.storage.locations.find((location) => location.managed);
  const after = next.storage.locations.find((location) => location.id === before?.id);
  if (!before || !after?.managed || after.path === before.path) {
    return withLocations(next, managedLast(next.storage.locations));
  }
  const locations = next.storage.locations.flatMap((location): StorageLocation[] =>
    location.id === before.id
      ? [
          { ...before, name: oldName(before.name, next.storage.locations), managed: false },
          { ...after, id: newId(), managed: true },
        ]
      : [location],
  );
  return withLocations(next, managedLast(locations));
}
