// Reads the two tables the emulator presets are seeded from out of NextLevelOS's Python runner
// (public/nextlevel-launcher.py). Dev-only, like the rest of scripts/; the runner is only read.

/** A MAME_CUSTOM_ARGS value: an argument list, or the name of a method that builds one. */
export type MameEntry = string[] | { method: string };

/** Reads one Python string literal starting at `start`; returns the value and the index after it. */
function readString(text: string, start: number): { value: string; end: number } {
  const quote = text.charAt(start);
  let value = '';
  let i = start + 1;
  while (i < text.length && text.charAt(i) !== quote) {
    const char = text.charAt(i);
    if (char === '\\') {
      const next = text.charAt(i + 1);
      // \\ and escaped quotes decode; any other escape is kept as written (MAME reads "\n").
      value += next === '\\' || next === "'" || next === '"' ? next : `\\${next}`;
      i += 2;
    } else {
      value += char;
      i += 1;
    }
  }
  return { value, end: i + 1 };
}

/** Reads `[ 'a', "b", ... ]` starting at `start`. */
function readList(text: string, start: number): string[] {
  const values: string[] = [];
  let i = start + 1;
  while (i < text.length && text.charAt(i) !== ']') {
    const char = text.charAt(i);
    if (char === '"' || char === "'") {
      const read = readString(text, i);
      values.push(read.value);
      i = read.end;
    } else {
      i += 1;
    }
  }
  return values;
}

/** The body lines of a top-level `NAME = { ... }` dict, without comment lines. */
function dictLines(source: string, name: string): string[] {
  const start = source.indexOf(`\n${name} = {`);
  if (start < 0) throw new Error(`${name} not found in the runner`);
  const end = source.indexOf('\n}', start);
  return source
    .slice(start, end)
    .split('\n')
    .slice(1)
    .filter((line) => !line.trim().startsWith('#'));
}

/** Each entry `"key": value` of a dict whose entries fit on one line. */
function entries(source: string, name: string): Array<{ key: string; line: string; at: number }> {
  return dictLines(source, name).flatMap((line) => {
    const keyStart = line.search(/["']/);
    if (keyStart < 0) return [];
    const key = readString(line, keyStart);
    const colon = line.indexOf(':', key.end);
    if (colon < 0) return [];
    const at = line.slice(colon + 1).search(/\S/) + colon + 1;
    return [{ key: key.value, line, at }];
  });
}

/** SYSTEM_EMULATORS: NextLevelOS system name → emulator keys, preferred first. */
export function parseSystemEmulators(source: string): Record<string, string[]> {
  return Object.fromEntries(
    entries(source, 'SYSTEM_EMULATORS')
      .filter(({ line, at }) => line.charAt(at) === '[')
      .map(({ key, line, at }) => [key, readList(line, at)]),
  );
}

/** MAME_CUSTOM_ARGS: NextLevelOS system name → MAME arguments or a builder method name. */
export function parseMameArgs(source: string): Record<string, MameEntry> {
  const result: Record<string, MameEntry> = {};
  for (const { key, line, at } of entries(source, 'MAME_CUSTOM_ARGS')) {
    const first = line.charAt(at);
    if (first === '[') result[key] = readList(line, at);
    else if (first === '"' || first === "'") result[key] = { method: readString(line, at).value };
  }
  return result;
}
