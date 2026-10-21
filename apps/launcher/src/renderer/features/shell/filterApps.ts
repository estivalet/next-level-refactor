import type { AppDefinition } from '../../apps/registry.ts';

/** Apps whose translated title contains `query` (case-insensitive); a blank query keeps all. */
export function filterApps(
  apps: readonly AppDefinition[],
  query: string,
  t: (key: string) => string,
): AppDefinition[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...apps];
  return apps.filter((app) => t(app.titleKey).toLocaleLowerCase().includes(needle));
}
