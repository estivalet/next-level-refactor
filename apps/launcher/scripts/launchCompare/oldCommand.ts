// NextLevelOS's launch command, built as its electron/main.cjs `launch-emulator` handler builds it
// (quirks kept: some tokens replace only their first match, `%romfilename%` reads a `rompath` the
// renderer never sets). Only read here; NextLevelOS is never changed.
import { posix } from 'node:path';

export interface OldLauncher {
  command?: string;
  rompath?: string[];
}

/** A gamelist entry; only the launch fields are read. */
export type OldGame = Record<string, unknown> & { filename?: string };

/** The per-game fields main.cjs puts into a command, in its order. */
export const LAUNCH_FIELDS = [
  'core',
  'config',
  'alt_core',
  'alt_game_config',
  'shader',
  'emulator',
  'artfolder',
  'launch_args',
  'mame_media',
  'squashfs_exe',
] as const;

/** A gamelist value as JavaScript's template strings in main.cjs would print it (`''` for none). */
export function text(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/** `%SYSTEMS_BASE_PATH%`: the first storage path whose system folder has the file, else the first. */
function basePath(
  launcher: OldLauncher,
  game: OldGame,
  storagePaths: readonly string[],
  exists: (path: string) => boolean,
): string {
  const template = launcher.rompath?.[0];
  if (!template || storagePaths.length <= 1) return storagePaths[0] ?? '';
  let filename = game.filename ?? '';
  if (filename.startsWith('./')) filename = filename.slice(2);
  const found = storagePaths.find((base) =>
    exists(posix.join(template.replace('%SYSTEMS_BASE_PATH%', base), filename)),
  );
  return found ?? storagePaths[0] ?? '';
}

/** The command line main.cjs would spawn for this game. */
export function oldCommandLine(
  launcher: OldLauncher,
  game: OldGame,
  storagePaths: readonly string[],
  runnerExe: string,
  exists: (path: string) => boolean,
): string {
  const filename = game.filename ?? '';
  const romName = filename.replace('./', '').replaceAll('/', '\\');
  const romNameNoExt = posix.parse(romName.replaceAll('\\', '/')).name;
  let command = launcher.command ?? '';
  command = command.replace('%NEXTLEVEL_RUNNER%', runnerExe);
  command = command.replaceAll(
    '%SYSTEMS_BASE_PATH%',
    basePath(launcher, game, storagePaths, exists),
  );
  command = command.replaceAll('%romname%', filename.replace('./', '').replace('/', '\\'));
  command = command.replaceAll('%romnamenoext%', romNameNoExt);
  command = command.replaceAll(
    '%romfilename%',
    `${text(game['rompath']) || 'undefined'}/${filename}`.replaceAll('/', '\\'),
  );
  command = command.replaceAll('%core%', text(game['core']));
  command = command.replaceAll('%alt_config%', text(game['config']));
  command = command.replaceAll('%alt_core%', text(game['alt_core']));
  command = command.replaceAll('%alt_game_config%', text(game['alt_game_config']));
  command = command.replaceAll('%shader%', text(game['shader']));
  command = command.replaceAll('%emulator%', text(game['emulator']));
  command = command.replaceAll('%artfolder%', text(game['artfolder']));
  command = command.replaceAll('%launch_args%', text(game['launch_args']));
  command = command.replaceAll('%mame_media%', text(game['mame_media']));
  command = command.replaceAll('%squashfs_exe%', text(game['squashfs_exe']));
  return command;
}

/** main.cjs's parser: splits on spaces outside quotes and drops the quotes. */
export function parseCommandLine(command: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let hasChars = false;
  for (const char of command) {
    if (char === '"') {
      inQuotes = !inQuotes;
      hasChars = true;
    } else if (char === ' ' && !inQuotes) {
      if (hasChars) {
        args.push(current);
        current = '';
        hasChars = false;
      }
    } else {
      current += char;
      hasChars = true;
    }
  }
  if (hasChars) args.push(current);
  return args;
}

/** Tokens main.cjs left in the command (`%RETROARCH_PATH%`, `%name%`, …) and `undefined` paths. */
export function brokenParts(command: string): string[] {
  const tokens = command.match(/%[A-Za-z_]+%/g) ?? [];
  return [...new Set([...tokens, ...(command.includes('undefined\\') ? ['undefined\\'] : [])])];
}

/** The launch fields that tell this game apart from the system's other games. */
export function variantKey(game: OldGame): string {
  return LAUNCH_FIELDS.map((field) => text(game[field])).join('\u0000');
}

/** The first game of each launch variant, with how many games share it. */
export function sampleVariants(games: readonly OldGame[]): Array<{ game: OldGame; count: number }> {
  const byKey = new Map<string, { game: OldGame; count: number }>();
  for (const game of games) {
    const key = variantKey(game);
    const seen = byKey.get(key);
    if (seen) seen.count += 1;
    else byKey.set(key, { game, count: 1 });
  }
  return [...byKey.values()];
}
