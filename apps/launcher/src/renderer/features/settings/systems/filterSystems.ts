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
 * Applies a change to one system's settings. Keys set to undefined are removed, and an entry
 * that is back to the defaults (disabled, no overrides) is dropped so settings stay small.
 */
export function withSystem(settings: Settings, id: string, patch: SystemPatch): Settings {
  const merged = Object.fromEntries(
    Object.entries({ enabled: false, ...settings.systems[id], ...patch }).filter(
      ([, value]) => value !== undefined,
    ),
  );
  const others = Object.fromEntries(Object.entries(settings.systems).filter(([key]) => key !== id));
  const isDefault = merged['enabled'] === false && Object.keys(merged).length === 1;
  return {
    ...settings,
    systems: isDefault ? others : { ...others, [id]: merged as SystemSettings },
  };
}
