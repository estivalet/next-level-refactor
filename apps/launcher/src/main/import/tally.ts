import type { ImportArea, ImportItem, ImportReason } from '@nextlevel/shared';

/**
 * Counts report items per (area, key, reason): 98k games produce a few hundred report rows, not
 * one per entry. `detail` keeps the first value given.
 */
export class Tally {
  private readonly rows = new Map<string, ImportItem>();

  add(area: ImportArea, key: string, reason: ImportReason, detail?: string, count = 1): void {
    if (count <= 0) return;
    const id = `${area}\u0000${key}\u0000${reason}`;
    const row = this.rows.get(id);
    if (row) row.count = (row.count ?? 0) + count;
    else this.rows.set(id, { area, key, reason, ...(detail ? { detail } : {}), count });
  }

  items(): ImportItem[] {
    return [...this.rows.values()];
  }
}
