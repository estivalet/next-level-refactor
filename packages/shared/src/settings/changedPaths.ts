function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Dotted leaf paths whose values differ between two JSON values, sorted; arrays compare whole. */
export function changedPaths(before: unknown, after: unknown, prefix = ''): string[] {
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys]
      .flatMap((key) => changedPaths(before[key], after[key], prefix ? `${prefix}.${key}` : key))
      .sort();
  }
  return JSON.stringify(before) === JSON.stringify(after) ? [] : [prefix];
}
