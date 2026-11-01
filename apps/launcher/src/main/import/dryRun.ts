import {
  IMPORT_MAPPED_REASONS,
  type DetectedEmulator,
  type EmulatorPreset,
  type ImportItem,
  type ImportProgress,
  type ImportReport,
  type ImportSystemCounts,
  type LegacyMenuItem,
  type MenuDocNode,
  type Settings,
  type SystemDefinition,
} from '@nextlevel/shared';
import { dirname } from 'node:path';
import type { FoundGame } from '../library/LibraryRepository.ts';
import { planScan } from '../scan/plan.ts';
import type { Walker } from '../scan/walker.ts';
import { addDetectedProfiles } from './detectedProfiles.ts';
import { mapCollections, type CollectionImport } from './mapCollections.ts';
import { mapGames, type GameImport } from './mapGames.ts';
import { mapMenus, type MenuImport } from './mapMenus.ts';
import { mapSettings, systemsInUse } from './mapSettings.ts';
import { createSystemMatcher } from './matchSystem.ts';
import { addSystemConfigs, type SystemConfig } from './systemConfigs.ts';
import { launcherKey, readLegacy, type LegacyFiles } from './readLegacy.ts';

/** What the library already holds from earlier imports, and names made here (D12). */
export interface ExistingImports {
  collections: Array<{ name: string; source: string | null }>;
  menuSources: string[];
}

export interface ImportDeps {
  catalog: readonly SystemDefinition[];
  presets: readonly EmulatorPreset[];
  /** The current (valid) settings; the dry run never writes them. */
  settings: () => Settings;
  newId: () => string;
  detect: (folder: string) => Promise<DetectedEmulator[]>;
  createWalker: () => Walker;
  folderExists: (dir: string) => Promise<boolean>;
  fileExists: (path: string) => Promise<boolean>;
  existing: () => ExistingImports;
}

/** Everything an import would write, computed without writing (IA F6). */
export interface ImportPlan {
  fingerprint: string;
  files: LegacyFiles;
  settings: Settings;
  /** Emulators found in the emulators folder (D14); the apply re-applies them to fresh settings. */
  detected: DetectedEmulator[];
  /** RetroArch system configs found on disk; the apply re-applies them too. */
  systemConfigs: SystemConfig[];
  /** Systems the import enables (scanned after games are written). */
  systemIds: string[];
  games: GameImport[];
  /**
   * Collections a menu uses, with the name each will have here (`<name> (NextLevelOS)` on a
   * clash). Lists no menu opens (old copies) are reported and left out.
   */
  collections: Array<CollectionImport & { source: string; finalName: string }>;
  menus: MenuImport[];
  mapped: ImportItem[];
  unmapped: ImportItem[];
  willReplace: ImportItem[];
}

const MAPPED = new Set<string>(IMPORT_MAPPED_REASONS);
const SUFFIX = ' (NextLevelOS)';

function countItems(items: readonly LegacyMenuItem[]): number {
  return items.reduce((sum, item) => sum + 1 + countItems(item.items ?? []), 0);
}

/** The RetroArch folder: a detected one, else one already set up here. */
function retroarchDir(detected: readonly DetectedEmulator[], settings: Settings): string | null {
  const executable =
    detected.find((e) => e.presetId === 'retroarch')?.executable ??
    settings.emulators.find((e) => e.presetId === 'retroarch')?.executable;
  return executable ? dirname(executable) : null;
}

/** Each imported system's `<RA>\config\<system name>.cfg` that exists (nextlevel-launcher.py's `-c`). */
async function systemConfigs(
  files: LegacyFiles,
  match: (name: string) => string | null,
  dir: string | null,
  fileExists: (path: string) => Promise<boolean>,
): Promise<SystemConfig[]> {
  if (!dir) return [];
  const names = [...systemsInUse(files)].sort((a, b) => a.localeCompare(b));
  const found = await Promise.all(
    names.map(async (name): Promise<SystemConfig[]> => {
      const systemId = match(name);
      const path = `${dir}\\config\\${name}.cfg`;
      return systemId && (await fileExists(path)) ? [{ systemId, name, path }] : [];
    }),
  );
  return found.flat();
}

/** `X (NextLevelOS)`, then `X (NextLevelOS 2)`, … — the first name nobody holds, ≤ 100 chars. */
function freeName(name: string, taken: ReadonlySet<string>): string {
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? SUFFIX : ` (NextLevelOS ${String(n)})`;
    const candidate = `${name.slice(0, 100 - suffix.length)}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/**
 * The name each collection gets (D12). One imported before keeps the name it has here; a new one
 * takes its NextLevelOS name unless any other collection (made here, or imported and renamed)
 * or one named earlier in this run holds it, then a suffix.
 */
function nameCollections(
  collections: readonly CollectionImport[],
  existing: ExistingImports,
  unmapped: ImportItem[],
  willReplace: ImportItem[],
): ImportPlan['collections'] {
  const bySource = new Map(
    existing.collections.flatMap((c) => (c.source ? [[c.source, c.name] as const] : [])),
  );
  const taken = new Set(existing.collections.map((c) => c.name.toLowerCase()));
  return collections.map((collection) => {
    const source = `nextlevelos:${collection.name}`;
    const current = bySource.get(source);
    if (current !== undefined) {
      willReplace.push({ area: 'collection', key: collection.name, reason: 'replacesImport' });
      return { ...collection, source, finalName: current };
    }
    let finalName = collection.name.slice(0, 100);
    if (taken.has(finalName.toLowerCase())) {
      finalName = freeName(collection.name, taken);
      unmapped.push({
        area: 'collection',
        key: collection.name,
        reason: 'nameConflict',
        detail: finalName,
      });
    }
    taken.add(finalName.toLowerCase());
    return { ...collection, source, finalName };
  });
}

/** Lower-case names of the collections the menus open. */
function menuCollections(menus: readonly MenuImport[]): Set<string> {
  const names = new Set<string>();
  const walk = (nodes: readonly MenuDocNode[]) => {
    for (const node of nodes) {
      if (node.type === 'collection' && node.refId) names.add(node.refId.toLowerCase());
      walk(node.children);
    }
  };
  for (const menu of menus) walk(menu.nodes);
  return names;
}

/** Reads the folder and maps everything (no writes): the dry run and the apply both start here. */
export async function planImport(
  folder: string,
  emulatorsFolder: string | null,
  deps: ImportDeps,
): Promise<ImportPlan> {
  const { files, problems, fingerprint } = await readLegacy(folder);
  const match = createSystemMatcher(deps.catalog);
  const current = deps.settings();
  const mapped = mapSettings(files, deps.catalog, current, deps.newId);
  const detected = emulatorsFolder ? await deps.detect(emulatorsFolder) : [];
  const withProfiles = addDetectedProfiles(
    mapped.next,
    detected,
    deps.catalog,
    deps.presets,
    deps.newId,
  );
  const raDir = retroarchDir(detected, current);
  const configs = await systemConfigs(files, match, raDir, deps.fileExists);
  const withConfigs = addSystemConfigs(withProfiles.next, configs, deps.newId);
  const games = mapGames(files, match, { retroarchDir: raDir });
  const collections = mapCollections(files, match);
  const names = new Set(collections.collections.map((c) => c.name.toLowerCase()));
  const menus = mapMenus(files, match, names, deps.newId);
  const used = menuCollections(menus.menus);
  const inMenus = collections.collections.filter((c) => used.has(c.name.toLowerCase()));
  const notInMenus = collections.collections.filter((c) => !used.has(c.name.toLowerCase()));
  const skipped = new Set(notInMenus.map((c) => c.name));

  const items = [
    ...problems,
    ...mapped.items,
    ...withProfiles.items,
    ...withConfigs.items,
    ...games.items,
    ...collections.items.filter((item) => !skipped.has(item.key)),
    ...notInMenus.map((c): ImportItem => ({
      area: 'collection',
      key: c.name,
      reason: 'notInMenu',
      ...(c.entries.length > 0 ? { count: c.entries.length } : {}),
    })),
    ...menus.items,
  ];
  const unmapped = items.filter((item) => !MAPPED.has(item.reason));
  const willReplace: ImportItem[] = [];
  const existing = deps.existing();
  const named = nameCollections(inMenus, existing, unmapped, willReplace);
  const menuSources = new Set(existing.menuSources);
  for (const menu of menus.menus) {
    if (menuSources.has(menu.source)) {
      willReplace.push({ area: 'menu', key: menu.file, reason: 'replacesImport' });
    }
  }
  const systemIds = [...systemsInUse(files)].flatMap((name) => {
    const id = match(name);
    return id && withConfigs.next.systems[id]?.enabled ? [id] : [];
  });
  return {
    fingerprint,
    files,
    settings: withConfigs.next,
    detected,
    systemConfigs: configs,
    systemIds: [...new Set(systemIds)].sort(),
    games: games.entries,
    collections: named,
    menus: menus.menus,
    mapped: items.filter((item) => MAPPED.has(item.reason)),
    unmapped,
    willReplace,
  };
}

/** Per system: entries with a file, entries that will be missing (D13), files without an entry. */
function systemCounts(
  systemId: string,
  entries: readonly GameImport[],
  found: readonly FoundGame[],
): ImportSystemCounts {
  const paths = new Map(found.map((file) => [file.relPath.toLowerCase(), file]));
  const groups = new Map(
    found.flatMap((file) => (file.discGroup ? [[file.discGroup.toLowerCase(), file]] : [])),
  );
  const used = new Set<FoundGame>();
  let withFile = 0;
  for (const entry of entries) {
    const file =
      paths.get(entry.relPath.toLowerCase()) ??
      (entry.discGroup ? groups.get(entry.discGroup.toLowerCase()) : undefined);
    if (file) {
      withFile += 1;
      used.add(file);
    }
  }
  return {
    systemId,
    entries: entries.length,
    withFile,
    missing: entries.length - withFile,
    newFiles: found.length - used.size,
  };
}

/**
 * The import's dry run (FR-IMP-2, IA F6): maps the folder, walks the would-be system folders
 * read-only and reports what the import would do. Writes nothing anywhere.
 */
export async function dryRun(
  folder: string,
  emulatorsFolder: string | null,
  deps: ImportDeps,
  onProgress: (progress: ImportProgress) => void = () => undefined,
): Promise<ImportReport> {
  const plan = await planImport(folder, emulatorsFolder, deps);
  const bySystem = new Map<string, GameImport[]>();
  for (const game of plan.games) {
    const list = bySystem.get(game.systemId);
    if (list) list.push(game);
    else bySystem.set(game.systemId, [game]);
  }
  const jobs = await planScan(plan.settings, deps.catalog, plan.systemIds, deps.folderExists);
  const walker = deps.createWalker();
  const systems: ImportSystemCounts[] = [];
  try {
    for (const [index, job] of jobs.entries()) {
      onProgress({ stage: 'scan', done: index, total: jobs.length });
      const walked = await walker.walk(job);
      systems.push(systemCounts(job.systemId, bySystem.get(job.systemId) ?? [], walked.files));
    }
  } finally {
    walker.stop();
  }
  const { files } = plan;
  const isSystemList = (name: string) => launcherKey(files.launchers, name) !== undefined;
  const systemLists = files.gamelists.filter((g) => isSystemList(g.name));
  const imported = new Set(plan.collections.map((c) => c.name));
  const collectionLists = files.gamelists.filter((g) => imported.has(g.name));
  return {
    source: folder,
    token: plan.fingerprint,
    counts: {
      systems: plan.systemIds.length,
      menus: files.menus.length,
      menuNodes: files.menus.reduce((sum, { menu }) => sum + countItems(menu.items), 0),
      gamelists: systemLists.length,
      games: systemLists.reduce((sum, list) => sum + list.games.length, 0),
      collections: collectionLists.length,
      collectionEntries: collectionLists.reduce((sum, list) => sum + list.games.length, 0),
    },
    systems: systems.sort((a, b) => a.systemId.localeCompare(b.systemId)),
    mapped: plan.mapped,
    unmapped: plan.unmapped,
    willReplace: plan.willReplace,
  };
}
