/** A command as each launcher would start it; `error` when it couldn't build one. */
export interface Built {
  exe: string | null;
  args: string[];
  cwd: string | null;
  env: Record<string, string>;
  error: string | null;
}

export type Outcome =
  | 'match' // same exe, arguments, working folder and environment
  | 'cwdOrEnv' // same exe and arguments; working folder or environment differs
  | 'order' // same exe and arguments in another order
  | 'missingConfig' // same, but NextLevelOS also appends a config file that isn't there
  | 'args' // same exe, different arguments
  | 'emulator' // a different program
  | 'newError' // only the rebuild can't launch it
  | 'oldError' // only NextLevelOS can't launch it
  | 'bothError';

export const OUTCOMES: readonly Outcome[] = [
  'match',
  'cwdOrEnv',
  'order',
  'missingConfig',
  'args',
  'emulator',
  'newError',
  'oldError',
  'bothError',
];

/** Windows compares paths without case and with either slash; `.\` segments and doubled or trailing slashes don't matter. */
export function normalize(value: string): string {
  return value
    .replaceAll('/', '\\')
    .replace(/\\\.(?=\\)/g, '')
    .replace(/\\{2,}/g, '\\')
    .replace(/\\$/, '')
    .toLowerCase();
}

/** Old args the runner passes as empty strings (`['']`) carry nothing. */
const meaningful = (args: readonly string[]) => args.filter((arg) => arg !== '');

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, i) => normalize(value) === normalize(b[i] ?? ''));

function sameEnv(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].map((key) => key.toUpperCase()));
  const get = (env: Record<string, string>, key: string) =>
    Object.entries(env).find(([name]) => name.toUpperCase() === key)?.[1] ?? '';
  return [...keys].every((key) => normalize(get(a, key)) === normalize(get(b, key)));
}

/**
 * A game's own values, shown as tokens so its arguments compare with the other launcher's and
 * differences group across games: `paths` anywhere in an argument (longest first: the ROM on
 * every drive before its folder), `segments` only as a whole path segment (system name, ROM stem).
 */
export interface Placeholders {
  paths: ReadonlyArray<readonly [path: string, token: string]>;
  segments: ReadonlyArray<readonly [name: string, token: string]>;
}

export const NO_PLACEHOLDERS: Placeholders = { paths: [], segments: [] };

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** An argument normalized, with the game's own values replaced by `{rom}`, `{systemDir}`, …. */
export function templated(arg: string, placeholders: Placeholders): string {
  let value = normalize(arg);
  for (const [path, token] of placeholders.paths) {
    if (path) value = value.replaceAll(normalize(path), token);
  }
  for (const [name, token] of placeholders.segments) {
    if (!name) continue;
    const segment = new RegExp(
      `(?<=\\\\)${escapeRegExp(normalize(name))}(?=\\\\|\\.[a-z0-9]+$|$)`,
      'g',
    );
    value = value.replace(segment, token);
  }
  return value;
}

/** Arguments only one side passes (each counted as often as it appears). */
export function argDiff(
  old: readonly string[],
  next: readonly string[],
  placeholders: Placeholders,
): { onlyOld: string[]; onlyNew: string[] } {
  const remaining = meaningful(next).map((arg) => templated(arg, placeholders));
  const onlyOld: string[] = [];
  for (const arg of meaningful(old).map((value) => templated(value, placeholders))) {
    const at = remaining.indexOf(arg);
    if (at >= 0) remaining.splice(at, 1);
    else onlyOld.push(arg);
  }
  return { onlyOld, onlyNew: remaining };
}

/** Old arguments without each `--appendconfig <file>` whose file isn't there (RetroArch skips it). */
function withoutMissingAppends(args: readonly string[], exists: (path: string) => boolean) {
  return args.filter((arg, i) => {
    if (arg === '--appendconfig') return exists(args[i + 1] ?? '');
    return !(args[i - 1] === '--appendconfig' && !exists(arg));
  });
}

/**
 * Compares after `placeholders`, so the same game on another drive still matches. With `exists`,
 * a difference that is only old `--appendconfig`s of missing files is `missingConfig`.
 */
export function classify(
  old: Built,
  next: Built,
  placeholders = NO_PLACEHOLDERS,
  exists?: (path: string) => boolean,
): Outcome {
  const outcome = compareBuilt(old, next, placeholders);
  if (outcome !== 'args' || !exists) return outcome;
  const trimmed = { ...old, args: withoutMissingAppends(old.args, exists) };
  return compareBuilt(trimmed, next, placeholders) === 'match' ? 'missingConfig' : outcome;
}

/** Flags RetroArch reads once: a later one replaces an earlier one (retroarch.c, strlcpy). */
const LAST_WINS = new Set(['-c', '--appendconfig']);

/** The arguments a program acts on: for RetroArch, only the last of each `LAST_WINS` flag. */
function effective(exe: string, args: readonly string[]): string[] {
  if (!/(^|[\\/])retroarch\.exe$/i.test(exe)) return [...args];
  const last = new Map<string, number>();
  args.forEach((arg, i) => {
    if (LAST_WINS.has(arg)) last.set(arg, i);
  });
  return args.filter((arg, i) => {
    if (LAST_WINS.has(arg)) return last.get(arg) === i;
    const flag = args[i - 1] ?? '';
    return !(LAST_WINS.has(flag) && last.get(flag) !== i - 1);
  });
}

function compareBuilt(old: Built, next: Built, placeholders: Placeholders): Outcome {
  const oldFailed = old.error !== null || old.exe === null;
  const newFailed = next.error !== null || next.exe === null;
  if (oldFailed && newFailed) return 'bothError';
  if (oldFailed) return 'oldError';
  if (newFailed) return 'newError';
  if (normalize(old.exe ?? '') !== normalize(next.exe ?? '')) return 'emulator';
  const oldArgs = effective(old.exe ?? '', meaningful(old.args)).map((arg) =>
    templated(arg, placeholders),
  );
  const newArgs = effective(next.exe ?? '', meaningful(next.args)).map((arg) =>
    templated(arg, placeholders),
  );
  if (!sameList(oldArgs, newArgs)) {
    const diff = argDiff(oldArgs, newArgs, NO_PLACEHOLDERS);
    return diff.onlyOld.length === 0 && diff.onlyNew.length === 0 ? 'order' : 'args';
  }
  const sameCwd = normalize(old.cwd ?? '') === normalize(next.cwd ?? '');
  return sameCwd && sameEnv(old.env, next.env) ? 'match' : 'cwdOrEnv';
}
