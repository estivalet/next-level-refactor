type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]))
    );
  }
  return false;
}

/**
 * Three-way merge of a settings draft onto newer settings (FR-SET-2): whatever the user changed
 * from `base` wins, everything else comes from `next`. Objects merge per key; any other value
 * (including arrays) is taken whole.
 */
export function rebase(base: unknown, draft: unknown, next: unknown): unknown {
  if (isPlainObject(base) && isPlainObject(draft) && isPlainObject(next)) {
    const keys = new Set([...Object.keys(base), ...Object.keys(draft), ...Object.keys(next)]);
    const merged: PlainObject = {};
    for (const key of keys) {
      const value = rebase(base[key], draft[key], next[key]);
      if (value !== undefined) merged[key] = value;
    }
    return merged;
  }
  return deepEqual(base, draft) ? next : draft;
}
