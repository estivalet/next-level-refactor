import {
  normalizePath,
  orderedLocations,
  SettingsSchema,
  type ImportItem,
  type LegacyConfig,
  type LegacyLaunchers,
  type LegacyMenuItem,
  type Settings,
  type StorageLocation,
  type SystemDefinition,
  type SystemSettings,
} from '@nextlevel/shared';
import { mapThemes } from './mapThemes.ts';
import { createSystemMatcher } from './matchSystem.ts';
import { launcherKey, type LegacyFiles } from './readLegacy.ts';

const RUNNER = '%NEXTLEVEL_RUNNER%';
const BASE_PATH = /^%SYSTEMS_BASE_PATH%[\\/]+/i;
const FOLDER_NAME = /^[^<>:"/\\|?*]{1,120}$/;
const ABSOLUTE = /^([a-zA-Z]:[\\/]|\\\\[^\\]+\\)/;
/** config.json keys only the NextLevelOS runner reads (WSL, squashfs mounts, temp folders). */
const HOOK_KEY = /^(wsl\.|squashfs\.|overlay\.|extraction\.)/;
const MAPPED_CONFIG_KEYS = new Set(['storage', 'assets', 'themesPath', 'menu']);

/** `e:/NextLevel/systems` → `e:\NextLevel\systems`. */
export const windowsPath = (path: string) => path.trim().replace(/\//g, '\\');

/** Names a menu opens as a gamelist: system nodes, and collection nodes or untyped leaves. */
function* menuListNames(items: readonly LegacyMenuItem[]): Generator<string> {
  for (const item of items) {
    const leaf = item.filter === undefined && !item.items?.length;
    if (
      item.type === 'system' ||
      (leaf && (item.type === undefined || item.type === 'collection'))
    ) {
      yield item.name;
    }
    if (item.items) yield* menuListNames(item.items);
  }
}

/** Launcher keys that have a gamelist or are opened by a menu node (names matched ignoring case). */
export function systemsInUse(files: LegacyFiles): Set<string> {
  const keys = new Set<string>();
  const add = (name: string) => {
    const key = launcherKey(files.launchers, name);
    if (key !== undefined) keys.add(key);
  };
  for (const list of files.gamelists) add(list.name);
  for (const { menu } of files.menus) for (const name of menuListNames(menu.items)) add(name);
  return keys;
}

function uniqueName(name: string, taken: Set<string>): string {
  const base = (name.trim() || 'Storage').slice(0, 34);
  let candidate = base;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base} (${String(n)})`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

/** Existing locations stay first; new paths follow in NextLevelOS priority order. */
function mapStorage(
  config: LegacyConfig | null,
  current: readonly StorageLocation[],
  newId: () => string,
  items: ImportItem[],
): StorageLocation[] {
  const paths = new Set(current.map((l) => normalizePath(l.path)));
  const names = new Set(current.map((l) => l.name.toLowerCase()));
  const legacy = (config?.storage ?? [])
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        (a.entry.priority ?? Infinity) - (b.entry.priority ?? Infinity) || a.index - b.index,
    );
  const added: StorageLocation[] = [];
  for (const { entry } of legacy) {
    const path = windowsPath(entry.path);
    if (!ABSOLUTE.test(path) || path.length < 3) {
      items.push({ area: 'storage', key: entry.path, reason: 'dropped' });
      continue;
    }
    if (paths.has(normalizePath(path))) continue;
    paths.add(normalizePath(path));
    const name = uniqueName(entry.name, names);
    added.push({ id: newId(), name, path, priority: 1 });
    items.push({ area: 'storage', key: name, reason: 'storageAdded', detail: path });
  }
  return orderedLocations([...current, ...added]);
}

/** A system's folder and extensions from its launcher, when they differ from the catalog. */
function launcherOverrides(
  name: string,
  launcher: LegacyLaunchers[string],
  def: SystemDefinition,
  items: ImportItem[],
): Partial<SystemSettings> {
  const overrides: Partial<SystemSettings> = {};
  const rompath = launcher.rompath[0];
  if (rompath && BASE_PATH.test(rompath)) {
    const folder = rompath.replace(BASE_PATH, '').replace(/[\\/]+$/, '');
    if (!FOLDER_NAME.test(folder)) {
      items.push({ area: 'system', key: name, reason: 'dropped', detail: rompath });
    } else if (folder.toLowerCase() !== def.defaultFolderName.toLowerCase()) {
      overrides.folderName = folder;
      items.push({ area: 'system', key: name, reason: 'folderName', detail: folder });
    }
  } else if (rompath) {
    items.push({ area: 'system', key: name, reason: 'absoluteRompath', detail: rompath });
  }
  // NextLevelOS scanned config scanExtensions plus the launcher's romext, so romext adds to the
  // catalog's list (which was seeded from scanExtensions) rather than replacing it.
  const added = (launcher.romext ?? [])
    .map((e) => e.trim().replace(/^\./, '').toLowerCase())
    .filter((e) => /^[a-z0-9]+$/.test(e) && !def.extensions.includes(e));
  if (added.length > 0) {
    overrides.extensions = [...def.extensions, ...new Set(added)];
    items.push({ area: 'system', key: name, reason: 'extensions', detail: added.join(', ') });
  }
  return overrides;
}

function mapSystems(
  files: LegacyFiles,
  catalog: readonly SystemDefinition[],
  match: (name: string) => string | null,
  current: Settings['systems'],
  items: ImportItem[],
): Settings['systems'] {
  const byId = new Map(catalog.map((system) => [system.id, system]));
  const inUse = systemsInUse(files);
  const systems = { ...current };
  for (const [name, launcher] of Object.entries(files.launchers)) {
    if (!launcher.command.includes(RUNNER)) {
      items.push({
        area: 'emulator',
        key: name,
        reason: 'customCommand',
        detail: launcher.command,
      });
    }
    if (launcher.emulators)
      items.push({ area: 'system', key: name, reason: 'dropped', detail: 'emulators' });
    if (launcher.gameArt)
      items.push({ area: 'system', key: name, reason: 'dropped', detail: 'gameArt' });
    const id = match(name);
    const def = id ? byId.get(id) : undefined;
    if (!id || !def) {
      items.push({ area: 'system', key: name, reason: 'unknownSystem' });
      continue;
    }
    if (!inUse.has(name)) continue;
    systems[id] = {
      ...systems[id],
      ...launcherOverrides(name, launcher, def, items),
      enabled: true,
    };
    items.push({ area: 'system', key: name, reason: 'systemEnabled' });
  }
  for (const [name, screenscraperId] of Object.entries(files.screenscraper)) {
    const id = match(name);
    const def = id ? byId.get(id) : undefined;
    if (!id || !def) {
      items.push({ area: 'scraper', key: name, reason: 'unknownSystem' });
    } else if (def.scraper.screenscraperId !== screenscraperId && systems[id]) {
      // Only systems already in settings: a new `{ enabled: false }` entry would stop scans from
      // finding that system's folder (planScan treats it as switched off by the user).
      systems[id] = { ...systems[id], screenscraperId };
      items.push({
        area: 'scraper',
        key: name,
        reason: 'screenscraperId',
        detail: String(screenscraperId),
      });
    }
  }
  return systems;
}

function reportConfigKeys(config: LegacyConfig | null, items: ImportItem[]): void {
  for (const key of Object.keys(config ?? {})) {
    if (MAPPED_CONFIG_KEYS.has(key)) continue;
    items.push({ area: 'config', key, reason: HOOK_KEY.test(key) ? 'hookSetting' : 'dropped' });
  }
}

function artFolder(
  path: string | undefined,
  current: string | null,
  key: string,
  items: ImportItem[],
) {
  if (!path) return current;
  const folder = windowsPath(path);
  if (!ABSOLUTE.test(folder)) {
    items.push({ area: 'config', key, reason: 'dropped', detail: path });
    return current;
  }
  items.push({ area: 'config', key, reason: 'artFolder', detail: folder });
  return folder;
}

/**
 * NextLevelOS settings → launcher settings (FR-IMP-1, data model §6). Pure: returns the next
 * settings and what was mapped or not. Systems with a gamelist or a menu node are enabled with
 * their launcher's folder and extensions; NextLevelOS wins over values set here (D12), and
 * nothing is ever switched off.
 */
export function mapSettings(
  files: LegacyFiles,
  catalog: readonly SystemDefinition[],
  current: Settings,
  newId: () => string,
): { next: Settings; items: ImportItem[] } {
  const items: ImportItem[] = [];
  const match = createSystemMatcher(catalog);
  const locations = mapStorage(files.config, current.storage.locations, newId, items);
  const systems = mapSystems(files, catalog, match, current.systems, items);
  reportConfigKeys(files.config, items);
  const themes = mapThemes(files.themes, current.themes, match);
  items.push(...themes.items);
  const next = SettingsSchema.parse({
    ...current,
    storage: {
      locations,
      assetsPath: artFolder(files.config?.assets, current.storage.assetsPath, 'assets', items),
      themesPath: artFolder(
        files.config?.themesPath,
        current.storage.themesPath,
        'themesPath',
        items,
      ),
    },
    systems,
    themes: themes.themes,
  });
  return { next, items };
}
