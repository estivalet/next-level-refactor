import type { Settings } from './schema.ts';

// A NextLevel folder that moved (another drive letter or PC, D50): settings paths inside the old
// folder follow it. Paths outside it (a ROM drive, an emulator elsewhere) are left as they are.

const unify = (path: string) => path.replace(/\//g, '\\').replace(/\\+$/, '');

/** `path` moved from under `from` to under `to`, or null when it isn't inside `from`. */
export function relocatedPath(path: string, from: string, to: string): string | null {
  const p = unify(path);
  const f = unify(from);
  const lower = p.toLowerCase();
  const prefix = f.toLowerCase();
  // Whole segments only: E:\NextLevel is not a prefix of E:\NextLevel2.
  if (lower !== prefix && !lower.startsWith(`${prefix}\\`)) return null;
  return `${unify(to)}${p.slice(f.length)}`;
}

/** Whether two folders are the same one (case, slashes and a trailing separator aside). */
export function sameFolder(a: string, b: string): boolean {
  return unify(a).toLowerCase() === unify(b).toLowerCase();
}

/**
 * Rewrites storage locations, the art and theme folders, the central media folder and emulator
 * executables under `from` to the same place under `to`; `changed` counts the paths rewritten.
 */
export function relocatePaths(
  settings: Settings,
  from: string,
  to: string,
): { settings: Settings; changed: number } {
  let changed = 0;
  const move = (path: string): string => {
    const next = relocatedPath(path, from, to);
    if (next === null) return path;
    changed += 1;
    return next;
  };
  const moveOptional = (path: string | null) => (path === null ? null : move(path));
  const { storage } = settings;
  const next: Settings = {
    ...settings,
    storage: {
      ...storage,
      locations: storage.locations.map((location) => ({ ...location, path: move(location.path) })),
      assetsPath: moveOptional(storage.assetsPath),
      themesPath: moveOptional(storage.themesPath),
      media:
        storage.media.mode === 'central'
          ? { mode: 'central', path: move(storage.media.path) }
          : storage.media,
    },
    emulators: settings.emulators.map((emulator) => ({
      ...emulator,
      executable: move(emulator.executable),
    })),
  };
  return { settings: next, changed };
}
