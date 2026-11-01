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

  return {
    files: {
      config: config.value,
      launchers: launchers.value ?? {},
      menus,
      gamelists,
      themes: themes.value,
      screenscraper: screenscraper.value ?? {},
    },
    problems,
    fingerprint: createHash('sha256').update(stamps.sort().join('\n')).digest('hex'),
  };
}
