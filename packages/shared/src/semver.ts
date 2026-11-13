// Semantic versions for updates and the minimum launcher version (NFR-UPD-1). Build metadata
// (`+…`) is not used by NextLevel releases and is not accepted.

const VERSION =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

/** Whether `text` is `x.y.z` or `x.y.z-pre`, optionally with a leading `v` (a release tag). */
export function isVersion(text: string): boolean {
  return VERSION.test(text);
}

function parse(text: string): { core: number[]; pre: string[] } {
  const match = VERSION.exec(text);
  if (!match) throw new Error(`Not a version: ${text}`);
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] ? match[4].split('.') : [],
  };
}

const sign = (n: number): -1 | 0 | 1 => (n < 0 ? -1 : n > 0 ? 1 : 0);

function compareIdentifiers(a: string, b: string): number {
  const numA = /^\d+$/.test(a);
  const numB = /^\d+$/.test(b);
  if (numA && numB) return sign(Number(a) - Number(b));
  if (numA !== numB) return numA ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** -1, 0 or 1 as `a` is older than, the same as or newer than `b` (semver precedence). */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i += 1) {
    const diff = sign((left.core[i] ?? 0) - (right.core[i] ?? 0));
    if (diff !== 0) return diff;
  }
  if (left.pre.length === 0 || right.pre.length === 0)
    return sign(right.pre.length - left.pre.length);
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i += 1) {
    const x = left.pre[i];
    const y = right.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const diff = compareIdentifiers(x, y);
    if (diff !== 0) return sign(diff);
  }
  return 0;
}
