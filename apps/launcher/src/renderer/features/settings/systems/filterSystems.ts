import type { Settings, SystemDefinition, SystemSettings } from '@nextlevel/shared';

/** Systems matching `query` (name, short name, manufacturer or id), optionally only enabled ones. */
export function filterSystems(
  systems: readonly SystemDefinition[],
  query: string,
  settings: Settings['systems'],
  show: 'all' | 'enabled',
): SystemDefinition[] {
  const needle = query.trim().toLowerCase();
  return systems.filter((system) => {
    if (show === 'enabled' && settings[system.id]?.enabled !== true) return false;
    if (!needle) return true;
    return [system.name, system.shortName, system.manufacturer, system.id].some((text) =>
      text?.toLowerCase().includes(needle),
    );
  });
}

type SystemPatch = { [K in keyof SystemSettings]?: SystemSettings[K] | undefined };

/**
 * Applies a change to one system's settings; keys set to undefined are removed. The entry is
 * kept even when it is back to `{ enabled: false }`: an entry records that the user decided, so
 * a scan never turns that system back on (FR-LIB-3).
 */
export function withSystem(settings: Settings, id: string, patch: SystemPatch): Settings {
  const merged = Object.fromEntries(
    Object.entries({ enabled: false, ...settings.systems[id], ...patch }).filter(
      ([, value]) => value !== undefined,
    ),
  );
  return { ...settings, systems: { ...settings.systems, [id]: merged as SystemSettings } };
}

/** "z64, .N64  zip" → ['z64', 'n64', 'zip']; empty → undefined (use the catalog's list). */
export function parseExtensions(text: string): string[] | undefined {
  const list = text
    .split(/[\s,]+/)
    .map((e) => e.replace(/^\./, '').toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

/** The text input style of the system editors. */
export const INPUT =
  'w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';
