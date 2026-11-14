import type { Settings } from '@nextlevel/shared';

type SyncSection = Settings['sync'];

/**
 * The section when sync is turned on or off (D64): the key is created the first time sync is
 * turned on on this PC and names its play counters; a key made on another host (a copied
 * portable folder) is not reused.
 */
export function enabledSection(
  section: SyncSection,
  enabled: boolean,
  host: string,
  newId: () => string,
): SyncSection {
  const own = section.deviceHost === null || section.deviceHost === host;
  const deviceKey = section.deviceKey !== null && own ? section.deviceKey : null;
  return {
    enabled,
    deviceKey: deviceKey ?? (enabled ? newId() : null),
    deviceHost: deviceKey !== null || enabled ? host : section.deviceHost,
  };
}

/**
 * D64: the device key belongs to the PC it was made on. A section from before deviceHost existed
 * adopts this host; one made on another host (a copied portable folder) gets a new key, so the old
 * key's plays count as the other PC's and nothing is counted twice. Null when nothing changes.
 */
export function claimedSection(
  section: SyncSection,
  host: string,
  newId: () => string,
): { section: SyncSection; copied: boolean } | null {
  if (section.deviceHost === host) return null;
  if (section.deviceHost !== null && section.deviceKey !== null) {
    return { section: { ...section, deviceKey: newId(), deviceHost: host }, copied: true };
  }
  return { section: { ...section, deviceHost: host }, copied: false };
}
