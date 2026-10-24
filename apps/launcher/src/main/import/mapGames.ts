import { LegacyGameSchema, type ImportItem, type LegacyGame } from '@nextlevel/shared';
import {
  discGroupOf,
  discOrder,
  fileStem,
  filterSlug,
  isFolder,
  normalizeRelPath,
  parseLastPlayed,
  parsePlayCount,
  parseYear,
  text,
} from './legacyGame.ts';
import { launcherKey, type LegacyFiles } from './readLegacy.ts';
import { Tally } from './tally.ts';

export { normalizeRelPath, parseLastPlayed };

/** One game from a NextLevelOS system gamelist, ready for the library (data model §6). */
export interface GameImport {
  systemId: string;
  relPath: string;
  /** The disc set name for `… (Disc N)` files (FR-LIB-5), else null. */
  discGroup: string | null;
  metadata: {
    title?: string;
    year?: number;
    developer?: string;
    publisher?: string;
    genre?: string;
    players?: string;
    description?: string;
  };
  /** Filter tags as slugs, without `favorite` (that is the favorite flag). */
  filters: string[];
  favorite: boolean;
  hidden: boolean;
  playCount: number;
  /** ISO time, or null. */
  lastPlayedAt: string | null;
  override: { core: string | null; extraArgs: string[] } | null;
  arcade: {
    rom: string | null;
    parent: string | null;
    driver: string | null;
    manufacturer: string | null;
  } | null;
}

export interface MapGamesOptions {
  /** RetroArch's folder, for per-game config and shader paths; null when it wasn't found. */
  retroarchDir: string | null;
}

const FAVORITE = 'favorite';
const MAX_FILTERS = 30;
/** Scraper bookkeeping NextLevelOS keeps per game; the scraper (M6) owns these. */
const SCRAPE_FIELDS = ['updatedAt', 'ai_updated', 'artfolder'] as const;

function launchOverride(
  game: LegacyGame,
  systemName: string,
  relPath: string,
  retroarchDir: string | null,
  tally: Tally,
): GameImport['override'] {
  const core = text(game.core) ?? null;
  const config = text(game.config);
  const gameConfig = text(game.alt_game_config);
  const shader = text(game.shader);
  const extraArgs: string[] = [];
  if ((config ?? gameConfig ?? shader) && !retroarchDir) {
    tally.add('game', systemName, 'retroarchNotFound');
  } else if (retroarchDir) {
    // As nextlevel-launcher.py builds them: <RA>\config\<config>.cfg and
    // <RA>\config\<system>\<alt config>\<rom stem>.cfg, shaders under <RA>\shaders.
    const configs = [
      ...(config ? [`${retroarchDir}\\config\\${config}.cfg`] : []),
      ...(gameConfig
        ? [`${retroarchDir}\\config\\${systemName}\\${gameConfig}\\${fileStem(relPath)}.cfg`]
        : []),
    ];
    if (configs.length > 0) extraArgs.push('--appendconfig', configs.join('|'));
    if (shader) {
      extraArgs.push('--set-shader', `${retroarchDir}\\shaders\\${shader.replace(/\//g, '\\')}`);
    }
  }
  if (!core && extraArgs.length === 0) return null;
  tally.add('game', systemName, 'launchOverride');
  return { core, extraArgs };
}

function arcadeInfo(game: LegacyGame): GameImport['arcade'] {
  const info = {
    rom: text(game.rom) ?? null,
    parent: text(game.parent) ?? null,
    driver: text(game.driver) ?? null,
    manufacturer: text(game.manufacturer) ?? null,
  };
  return Object.values(info).some((value) => value !== null) ? info : null;
}

function toImport(
  game: LegacyGame,
  systemId: string,
  systemName: string,
  relPath: string,
  options: MapGamesOptions,
  tally: Tally,
): GameImport {
  const tags = game.filter ?? [];
  const filters: string[] = [];
  let renamed = false;
  for (const tag of tags) {
    if (tag === FAVORITE) continue;
    const slug = filterSlug(tag);
    if (slug !== tag) renamed = true;
    if (slug && !filters.includes(slug)) filters.push(slug);
  }
  if (renamed) tally.add('game', systemName, 'filterRenamed');
  if (text(game.emulator) || text(game.launch_args) || text(game['alt_core'])) {
    tally.add('game', systemName, 'perGameEmulator');
  }
  if (text(game['squashfs_exe'])) tally.add('game', systemName, 'hookSetting');
  if (SCRAPE_FIELDS.some((field) => game[field] !== undefined)) {
    tally.add('game', systemName, 'scrapeInM6');
  }
  const arcade = arcadeInfo(game);
  if (arcade) tally.add('game', systemName, 'arcadeInfo');
  const metadata: GameImport['metadata'] = {};
  const set = <K extends keyof GameImport['metadata']>(
    key: K,
    value: GameImport['metadata'][K],
  ) => {
    if (value !== undefined) metadata[key] = value;
  };
  set('title', text(game.title));
  set('year', parseYear(game.year));
  set('developer', text(game.developer));
  set('publisher', text(game.publisher));
  set('genre', text(game.genre) ?? text(game.category));
  set('players', text(game.players));
  set('description', text(game.desc));
  return {
    systemId,
    relPath,
    discGroup: discGroupOf(relPath),
    metadata,
    filters: filters.slice(0, MAX_FILTERS),
    favorite: tags.includes(FAVORITE),
    hidden: game.hidden === true,
    playCount: parsePlayCount(game.played),
    lastPlayedAt: parseLastPlayed(game.lastPlayedOn),
    override: launchOverride(game, systemName, relPath, options.retroarchDir, tally),
    arcade,
  };
}

const later = (a: string | null, b: string | null) => (a && b ? (a > b ? a : b) : (a ?? b));

/** Two entries for one game: flags OR, plays max, later date; the first entry's fields win. */
function merge(first: GameImport, other: GameImport): GameImport {
  return {
    ...first,
    metadata: { ...other.metadata, ...first.metadata },
    filters: [...new Set([...first.filters, ...other.filters])].slice(0, MAX_FILTERS),
    favorite: first.favorite || other.favorite,
    hidden: first.hidden || other.hidden,
    playCount: Math.max(first.playCount, other.playCount),
    lastPlayedAt: later(first.lastPlayedAt, other.lastPlayedAt),
    override: first.override ?? other.override,
    arcade: first.arcade ?? other.arcade,
  };
}

const folderOf = (relPath: string) => relPath.slice(0, Math.max(0, relPath.lastIndexOf('/')));

/** Disc entries of one set (same folder and set name) become one game: the first disc. */
function mergeDiscSets(entries: GameImport[], systemName: string, tally: Tally): GameImport[] {
  const sets = new Map<string, GameImport[]>();
  for (const entry of entries) {
    if (!entry.discGroup) continue;
    const key = `${folderOf(entry.relPath)}/${entry.discGroup}`.toLowerCase();
    sets.set(key, [...(sets.get(key) ?? []), entry]);
  }
  const drop = new Set<GameImport>();
  const replace = new Map<GameImport, GameImport>();
  for (const discs of sets.values()) {
    if (discs.length < 2) continue;
    const [first, ...rest] = [...discs].sort(
      (a, b) => discOrder(a.relPath) - discOrder(b.relPath) || a.relPath.localeCompare(b.relPath),
    );
    if (!first) continue;
    replace.set(first, rest.reduce(merge, first));
    for (const disc of rest) drop.add(disc);
    tally.add('game', systemName, 'discSet', undefined, rest.length);
  }
  return entries.filter((e) => !drop.has(e)).map((e) => replace.get(e) ?? e);
}

/**
 * NextLevelOS system gamelists → games (FR-IMP-1). A gamelist is a system's when its name is a
 * launcher key; that name decides the system (entries carry stale `system` values). Duplicates
 * and disc sets merge; folders, unknown systems and fields NextLevel doesn't use are reported.
 */
export function mapGames(
  files: LegacyFiles,
  match: (name: string) => string | null,
  options: MapGamesOptions,
): { entries: GameImport[]; items: ImportItem[] } {
  const tally = new Tally();
  const entries: GameImport[] = [];
  for (const list of files.gamelists) {
    const name = launcherKey(files.launchers, list.name);
    if (name === undefined) continue;
    const systemId = match(name);
    if (!systemId) {
      tally.add('game', name, 'unknownSystem', undefined, list.games.length);
      continue;
    }
    const byPath = new Map<string, GameImport>();
    for (const raw of list.games) {
      const parsed = LegacyGameSchema.safeParse(raw);
      const relPath = parsed.success ? normalizeRelPath(parsed.data.filename) : null;
      if (!parsed.success || !relPath) {
        tally.add('game', name, 'invalidEntry');
        continue;
      }
      if (isFolder(parsed.data.folder)) {
        tally.add('game', name, 'folderEntry');
        continue;
      }
      const game = toImport(parsed.data, systemId, name, relPath, options, tally);
      const key = relPath.toLowerCase();
      const seen = byPath.get(key);
      if (seen) tally.add('game', name, 'duplicateEntry');
      byPath.set(key, seen ? merge(seen, game) : game);
    }
    entries.push(...mergeDiscSets([...byPath.values()], name, tally));
  }
  return { entries, items: tally.items() };
}
