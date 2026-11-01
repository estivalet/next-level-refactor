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
  | 'args' // same exe, different arguments
  | 'emulator' // a different program
  | 'newError' // only the rebuild can't launch it
  | 'oldError' // only NextLevelOS can't launch it
  | 'bothError';

export const OUTCOMES: readonly Outcome[] = [
  'match',
  'cwdOrEnv',
  'order',
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

/** Compares after `placeholders`, so the same game on another drive still matches. */
export function classify(old: Built, next: Built, placeholders = NO_PLACEHOLDERS): Outcome {
  const oldFailed = old.error !== null || old.exe === null;
  const newFailed = next.error !== null || next.exe === null;
  if (oldFailed && newFailed) return 'bothError';
  if (oldFailed) return 'oldError';
  if (newFailed) return 'newError';
  if (normalize(old.exe ?? '') !== normalize(next.exe ?? '')) return 'emulator';
  const oldArgs = meaningful(old.args).map((arg) => templated(arg, placeholders));
  const newArgs = meaningful(next.args).map((arg) => templated(arg, placeholders));
  if (!sameList(oldArgs, newArgs)) {
    const diff = argDiff(oldArgs, newArgs, NO_PLACEHOLDERS);
    return diff.onlyOld.length === 0 && diff.onlyNew.length === 0 ? 'order' : 'args';
  }
  const sameCwd = normalize(old.cwd ?? '') === normalize(next.cwd ?? '');
  return sameCwd && sameEnv(old.env, next.env) ? 'match' : 'cwdOrEnv';
}
