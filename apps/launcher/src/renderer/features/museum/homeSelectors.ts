import type { SystemInfoSummary } from '@nextlevel/shared';

/** The newest changedAt first; ISO strings compare chronologically. */
const byNewest = (a: SystemInfoSummary, b: SystemInfoSummary) =>
  (b.changedAt ?? '').localeCompare(a.changedAt ?? '');

/** The system on the Home hero: the most recently changed, else the first, else none (FR-MUS-9). */
export function featuredSystem(systems: readonly SystemInfoSummary[]): SystemInfoSummary | null {
  const [latest] = systems.filter((system) => system.changedAt !== null).sort(byNewest);
  return latest ?? systems[0] ?? null;
}

/** Systems changed by the owner, newest first (FR-MUS-9). */
export function recentlyChanged(
  systems: readonly SystemInfoSummary[],
  limit = 12,
): SystemInfoSummary[] {
  return systems
    .filter((system) => system.changedAt !== null)
    .sort(byNewest)
    .slice(0, limit);
}

/** Systems with the owner's notes, in list order (FR-MUS-9). */
export function withNotes(systems: readonly SystemInfoSummary[]): SystemInfoSummary[] {
  return systems.filter((system) => system.hasNotes);
}

/** The totals on the Home counts line. */
export function homeCounts(systems: readonly SystemInfoSummary[]) {
  return {
    systems: systems.length,
    edited: systems.filter((system) => system.edited).length,
    notes: withNotes(systems).length,
  };
}
