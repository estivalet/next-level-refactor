/** A copy of `items` with the item at `index` moved by `delta` places (a no-op at the ends). */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved as T);
  return next;
}

export function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, position) => position !== index);
}

export function replaceAt<T>(items: readonly T[], index: number, item: T): T[] {
  return items.map((current, position) => (position === index ? item : current));
}
