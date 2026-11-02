import {
  AppErrorException,
  ERROR_CODES,
  LegacyConfigSchema,
  LegacyGamelistSchema,
  LegacyLaunchersSchema,
  LegacyMenuSchema,
  LegacyScreenscraperSchema,
  LegacyThemesSchema,
  type ImportItem,
  type LegacyConfig,
  type LegacyLaunchers,
  type LegacyMenu,
  type LegacyMenuItem,
  type LegacyScreenscraper,
  type LegacyThemes,
} from '@nextlevel/shared';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { z } from 'zod';

/** The NextLevelOS files the importer reads (FR-IMP-1). Gamelist entries stay raw. */
export interface LegacyFiles {
  config: LegacyConfig | null;
  launchers: LegacyLaunchers;
  /** `menu*.json`, sorted by file name. */
  menus: Array<{ file: string; menu: LegacyMenu }>;
  /** `gamelists/<name>.json` that hold a games list, sorted by name. */
  gamelists: Array<{ name: string; games: unknown[] }>;
  themes: LegacyThemes | null;
  screenscraper: LegacyScreenscraper;
}

export interface LegacyRead {
  files: LegacyFiles;
  problems: ImportItem[];
  /** Hash of every read file's name, size and modified time (the dry run's report token). */
  fingerprint: string;
}

const keyIndex = new WeakMap<LegacyLaunchers, Map<string, string>>();

/**
 * The launcher key a name refers to, ignoring case: NextLevelOS found `Gamepark 32.json` for the
 * `GamePark 32` launcher through Windows' case-insensitive file system.
 */
export function launcherKey(launchers: LegacyLaunchers, name: string): string | undefined {
  let index = keyIndex.get(launchers);
  if (!index) {
    index = new Map(Object.keys(launchers).map((key) => [key.toLowerCase(), key]));
    keyIndex.set(launchers, index);
  }
  return index.get(name.toLowerCase());
}

/** Lower-case names the menus open with the given node type, at any depth. */
function menuNames(menus: LegacyFiles['menus'], type: string): Set<string> {
  const names = new Set<string>();
  const walk = (items: readonly LegacyMenuItem[]) => {
    for (const item of items) {
      if (item.type === type) names.add(item.name.trim().toLowerCase());
      walk(item.items ?? []);
    }
  };
  for (const { menu } of menus) walk(menu.items);
  return names;
}

/**
 * Launcher keys whose gamelist is really a collection: the menus open it only as a collection and
 * every game names another system that has a launcher. NextLevelOS kept "American Laser Games" in
 * launchers.json after its games moved to Singe; the import treats those lists as collections.
 * A list a menu opens as a system (Zemmix → Microsoft MSX games) stays a system.
 */
export function collectionLaunchers(
  launchers: LegacyLaunchers,
  gamelists: LegacyFiles['gamelists'],
  menus: LegacyFiles['menus'],
): string[] {
  const asCollection = menuNames(menus, 'collection');
  const asSystem = menuNames(menus, 'system');
  const keys: string[] = [];
  for (const list of gamelists) {
    const own = launcherKey(launchers, list.name);
    const name = list.name.toLowerCase();
    if (own === undefined || list.games.length === 0) continue;
    if (!asCollection.has(name) || asSystem.has(name)) continue;
    const elsewhere = list.games.every((game) => {
      const system = (game as { system?: unknown } | null)?.system;
      if (typeof system !== 'string') return false;
      const key = launcherKey(launchers, system.trim());
      return key !== undefined && key !== own;
    });
    if (elsewhere) keys.push(own);
  }
  return keys;
}

/**
 * The system name a launcher's runner command passes (`-s "Nintendo NES"` for Handy Vision), else
 * the key: nextlevel-launcher.py names RetroArch's config files after it.
 */
export function runnerSystem(launchers: LegacyLaunchers, key: string): string {
  const command = launchers[key]?.command ?? '';
  return /(?:^|\s)-s\s+"([^"]+)"/.exec(command)?.[1] ?? key;
}

/** Gamelists read at once; the owner's folder has ~1,000 of them. */
const CONCURRENCY = 16;

type Read = { kind: 'missing' } | { kind: 'invalid' } | { kind: 'ok'; value: unknown };

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Reads a NextLevelOS `public/data` folder (FR-IMP-1). Only reads: nothing is ever written there,
 * and `screenscraper.credentials.json` is never opened. Missing optional files are fine; a folder
 * with neither `config.json` nor `launchers.json` is refused (`NOT_FOUND`).
 */
export async function readLegacy(folder: string): Promise<LegacyRead> {
  const stamps: string[] = [];
  const problems: ImportItem[] = [];

  const read = async (relPath: string): Promise<Read> => {
    const path = join(folder, relPath);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) return { kind: 'missing' };
    stamps.push(`${relPath}|${String(info.size)}|${String(info.mtimeMs)}`);
    const text = await readFile(path, 'utf8');
    try {
      return { kind: 'ok', value: JSON.parse(text.replace(/^\uFEFF/, '')) as unknown };
    } catch {
      return { kind: 'invalid' };
    }
  };

  const parse = async <S extends z.ZodType>(
    relPath: string,
    schema: S,
    area: ImportItem['area'],
  ) => {
    const result = await read(relPath);
    if (result.kind === 'missing') return { found: false, value: null };
    const parsed = result.kind === 'ok' ? schema.safeParse(result.value) : null;
    if (!parsed?.success) {
      problems.push({ area, key: relPath, reason: 'invalidFile' });
      return { found: true, value: null };
    }
    return { found: true, value: parsed.data };
  };

  const config = await parse('config.json', LegacyConfigSchema, 'config');
  const launchers = await parse('launchers.json', LegacyLaunchersSchema, 'system');
  if (!config.found && !launchers.found) {
    throw new AppErrorException({
      code: 'NOT_FOUND',
      message: ERROR_CODES.NOT_FOUND,
      details: { reason: 'notNextLevelOS', folder },
    });
  }
  const themes = await parse('themes.json', LegacyThemesSchema, 'theme');
  const screenscraper = await parse('screenscraper.json', LegacyScreenscraperSchema, 'scraper');

  const topLevel = await readdir(folder).catch(() => []);
  const menuFiles = topLevel.filter((name) => /^menu.*\.json$/i.test(name)).sort();
  const menus: LegacyFiles['menus'] = [];
  for (const file of menuFiles) {
    const menu = await parse(file, LegacyMenuSchema, 'menu');
    if (menu.value) menus.push({ file, menu: menu.value });
  }

  const listFiles = (await readdir(join(folder, 'gamelists')).catch(() => []))
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort();
  const lists = await mapLimit(listFiles, CONCURRENCY, async (file) => ({
    file,
    result: await read(join('gamelists', file)),
  }));
  const gamelists: LegacyFiles['gamelists'] = [];
  for (const { file, result } of lists) {
    const key = `gamelists/${file}`;
    if (result.kind !== 'ok') {
      if (result.kind === 'invalid') problems.push({ area: 'game', key, reason: 'invalidFile' });
      continue;
    }
    const parsed = LegacyGamelistSchema.safeParse(result.value);
    if (parsed.success) gamelists.push({ name: file.slice(0, -5), games: parsed.data.games });
    else problems.push({ area: 'game', key, reason: 'notAGamelist' });
  }

  const allLaunchers = launchers.value ?? {};
  const asCollections = new Set(collectionLaunchers(allLaunchers, gamelists, menus));
  return {
    files: {
      config: config.value,
      launchers: Object.fromEntries(
        Object.entries(allLaunchers).filter(([key]) => !asCollections.has(key)),
      ),
      menus,
      gamelists,
      themes: themes.value,
      screenscraper: screenscraper.value ?? {},
    },
    problems,
    fingerprint: createHash('sha256').update(stamps.sort().join('\n')).digest('hex'),
  };
}
